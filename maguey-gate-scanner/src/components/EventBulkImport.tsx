import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Upload, FileSpreadsheet, FileText, CheckCircle2, XCircle, AlertTriangle, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { generateTicketTypeCode, normalizeTicketTypeName } from "@/lib/ticket-type-utils";
import Papa from "papaparse";
import * as XLSX from "xlsx";

interface ParsedEvent {
  event_name: string;
  event_date: string;
  event_time: string;
  venue_name?: string;
  venue_address?: string;
  city?: string;
  description?: string;
  image_url?: string;
  image_file?: File;
  ticket_types: Array<{
    name: string;
    price: number;
    capacity: number;
  }>;
}

interface ValidationResult {
  valid: ParsedEvent[];
  errors: Array<{
    row: number;
    field: string;
    message: string;
  }>;
  warnings: Array<{
    row: number;
    field: string;
    message: string;
  }>;
}

interface EventBulkImportProps {
  onImportComplete: () => void;
}

export function EventBulkImport({ onImportComplete }: EventBulkImportProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedEvent[]>([]);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [ticketTypeStrategy, setTicketTypeStrategy] = useState<'auto' | 'reuse' | 'manual'>('auto');
  const [importing, setImporting] = useState(false);
  const [existingTicketTypes, setExistingTicketTypes] = useState<Map<string, any>>(new Map());

  const downloadTemplate = () => {
    const template = [
      ['event_name', 'event_date', 'event_time', 'venue_name', 'venue_address', 'city', 'description', 'image_url', 'ticket_type_name', 'ticket_type_price', 'ticket_type_capacity'],
      ['New Years Eve Party', '2025-12-31', '21:00', 'Club Maguey', '123 Main St', 'Austin', 'Ring in 2025!', '', 'General Admission', '50', '200'],
      ['New Years Eve Party', '2025-12-31', '21:00', 'Club Maguey', '123 Main St', 'Austin', 'Ring in 2025!', '', 'VIP', '150', '50'],
      ['Valentine\'s Dance', '2025-02-14', '20:00', 'Club Maguey', '123 Main St', 'Austin', 'Love is in the air!', '', 'Couples Pass', '75', '100'],
    ];
    
    const csv = template.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'event_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "Template Downloaded",
      description: "CSV template downloaded. Fill it out and upload it.",
    });
  };

  const loadExistingTicketTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('ticket_types')
        .select('name, price, total_inventory');
      
      if (error) throw error;
      
      const map = new Map();
      (data || []).forEach(tt => {
        const normalized = normalizeTicketTypeName(tt.name);
        if (!map.has(normalized)) {
          map.set(normalized, tt);
        }
      });
      
      setExistingTicketTypes(map);
    } catch (error: any) {
      console.error('Error loading existing ticket types:', error);
    }
  };

  const validateAndPreview = (rawData: any[]): ValidationResult => {
    const grouped = new Map<string, any[]>();
    const errors: ValidationResult['errors'] = [];
    const warnings: ValidationResult['warnings'] = [];
    
    // Group rows by event_name + event_date (same event, multiple ticket types)
    rawData.forEach((row, index) => {
      const key = `${row.event_name}|${row.event_date}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push({ ...row, _rowIndex: index + 2 }); // +2 for header row
    });
    
    // Validate each event group
    const validEvents: ParsedEvent[] = [];
    
    grouped.forEach((rows, key) => {
      const firstRow = rows[0];
      const rowNum = firstRow._rowIndex;
      
      // Required field validation
      if (!firstRow.event_name?.trim()) {
        errors.push({ row: rowNum, field: 'event_name', message: 'Event name is required' });
        return;
      }
      
      if (!firstRow.event_date) {
        errors.push({ row: rowNum, field: 'event_date', message: 'Event date is required' });
        return;
      }
      
      // Date validation
      const eventDate = new Date(firstRow.event_date);
      if (isNaN(eventDate.getTime())) {
        errors.push({ row: rowNum, field: 'event_date', message: 'Invalid date format (use YYYY-MM-DD)' });
        return;
      }
      
      // Time validation
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (firstRow.event_time && !timeRegex.test(firstRow.event_time)) {
        errors.push({ row: rowNum, field: 'event_time', message: 'Time must be in HH:MM format (e.g., 21:00)' });
        return;
      }
      
      // Warning for missing venue
      if (!firstRow.venue_name?.trim()) {
        warnings.push({ row: rowNum, field: 'venue_name', message: 'Venue name is recommended' });
      }
      
      // Validate ticket types
      const ticketTypes: ParsedEvent['ticket_types'] = [];
      rows.forEach((row) => {
        if (!row.ticket_type_name?.trim()) {
          errors.push({ row: row._rowIndex, field: 'ticket_type_name', message: 'Ticket type name is required' });
          return;
        }
        
        const price = parseFloat(row.ticket_type_price);
        if (isNaN(price) || price < 0) {
          errors.push({ row: row._rowIndex, field: 'ticket_type_price', message: 'Invalid price (must be a number >= 0)' });
          return;
        }
        
        const capacity = parseInt(row.ticket_type_capacity);
        if (isNaN(capacity) || capacity <= 0) {
          errors.push({ row: row._rowIndex, field: 'ticket_type_capacity', message: 'Invalid capacity (must be a positive integer)' });
          return;
        }
        
        ticketTypes.push({
          name: row.ticket_type_name.trim(),
          price,
          capacity,
        });
      });
      
      if (ticketTypes.length === 0) {
        errors.push({ row: rowNum, field: 'ticket_types', message: 'At least one ticket type required' });
        return;
      }
      
      // Add to valid events
      validEvents.push({
        event_name: firstRow.event_name.trim(),
        event_date: firstRow.event_date,
        event_time: firstRow.event_time || '20:00',
        venue_name: firstRow.venue_name?.trim(),
        venue_address: firstRow.venue_address?.trim(),
        city: firstRow.city?.trim(),
        description: firstRow.description?.trim(),
        image_url: firstRow.image_url?.trim(),
        ticket_types: ticketTypes,
      });
    });
    
    return { valid: validEvents, errors, warnings };
  };

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setParsedData([]);
    setValidation(null);
    
    const fileType = selectedFile.name.split('.').pop()?.toLowerCase();
    
    try {
      let rawData: any[] = [];
      
      if (fileType === 'csv') {
        Papa.parse(selectedFile, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            rawData = results.data as any[];
            const validationResult = validateAndPreview(rawData);
            setValidation(validationResult);
            setParsedData(validationResult.valid);
            
            if (ticketTypeStrategy === 'reuse' || ticketTypeStrategy === 'manual') {
              loadExistingTicketTypes();
            }
          },
          error: (error) => {
            toast({
              variant: "destructive",
              title: "Parse Error",
              description: error.message,
            });
          }
        });
      } else if (fileType === 'xlsx' || fileType === 'xls') {
        const data = await selectedFile.arrayBuffer();
        const workbook = XLSX.read(data);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        rawData = XLSX.utils.sheet_to_json(worksheet);
        
        const validationResult = validateAndPreview(rawData);
        setValidation(validationResult);
        setParsedData(validationResult.valid);
        
        if (ticketTypeStrategy === 'reuse' || ticketTypeStrategy === 'manual') {
          loadExistingTicketTypes();
        }
      } else {
        toast({
          variant: "destructive",
          title: "Invalid File",
          description: "Please upload a CSV or Excel file (.csv, .xlsx, .xls)",
        });
        setFile(null);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to parse file",
      });
      setFile(null);
    }
  }, [ticketTypeStrategy, toast]);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  }, [handleFileSelect]);

  const executeBulkImport = async () => {
    if (!validation || validation.valid.length === 0) {
      toast({
        variant: "destructive",
        title: "No Valid Data",
        description: "Please fix errors before importing.",
      });
      return;
    }

    setImporting(true);
    
    try {
      let successCount = 0;
      let errorCount = 0;
      const importErrors: string[] = [];
      
      for (const event of validation.valid) {
        try {
          // Insert event
          const { data: newEvent, error: eventError } = await supabase
            .from('events')
            .insert({
              name: event.event_name,
              description: event.description || null,
              event_date: event.event_date,
              event_time: event.event_time,
              venue_name: event.venue_name || null,
              venue_address: event.venue_address || null,
              city: event.city || null,
              image_url: event.image_url || null,
            })
            .select()
            .single();
          
          if (eventError) throw eventError;
          
          // Handle ticket types based on strategy
          let ticketTypeRows: any[] = [];
          
          if (ticketTypeStrategy === 'auto') {
            // Auto-create all ticket types
            ticketTypeRows = event.ticket_types.map((tt, index) => ({
              event_id: newEvent.id,
              name: tt.name,
              code: generateTicketTypeCode(tt.name, index),
              price: tt.price,
              total_inventory: tt.capacity,
            }));
          } else if (ticketTypeStrategy === 'reuse') {
            // Reuse existing ticket types if names match
            ticketTypeRows = event.ticket_types.map((tt, index) => {
              const normalized = normalizeTicketTypeName(tt.name);
              const existing = existingTicketTypes.get(normalized);
              
              if (existing) {
                // Reuse existing configuration
                return {
                  event_id: newEvent.id,
                  name: existing.name, // Use existing name (preserves casing)
                  code: generateTicketTypeCode(existing.name, index),
                  price: existing.price,
                  total_inventory: existing.total_inventory,
                };
              } else {
                // Create new ticket type
                return {
                  event_id: newEvent.id,
                  name: tt.name,
                  code: generateTicketTypeCode(tt.name, index),
                  price: tt.price,
                  total_inventory: tt.capacity,
                };
              }
            });
          } else {
            // Manual mode - same as auto for now (could add UI for selection)
            ticketTypeRows = event.ticket_types.map((tt, index) => ({
              event_id: newEvent.id,
              name: tt.name,
              code: generateTicketTypeCode(tt.name, index),
              price: tt.price,
              total_inventory: tt.capacity,
            }));
          }
          
          // Insert ticket types
          const { error: ttError } = await supabase
            .from('ticket_types')
            .insert(ticketTypeRows);
          
          if (ttError) throw ttError;
          
          successCount++;
        } catch (error: any) {
          errorCount++;
          importErrors.push(`${event.event_name}: ${error.message}`);
        }
      }
      
      toast({
        title: "Import Complete",
        description: `${successCount} events imported successfully. ${errorCount} ${errorCount === 1 ? 'error' : 'errors'}.`,
        variant: errorCount > 0 ? "default" : "default",
      });
      
      if (importErrors.length > 0) {
        console.error('Import errors:', importErrors);
        // Could show detailed error dialog here
      }
      
      onImportComplete();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Import Failed",
        description: error.message,
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button variant="outline" onClick={downloadTemplate}>
          <Download className="mr-2 h-4 w-4" />
          Download Template
        </Button>
      </div>

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle>Upload File</CardTitle>
          <CardDescription>
            Drag and drop a file or click to select (CSV or Excel)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
            onDrop={handleFileDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.csv,.xlsx,.xls';
              input.onchange = (e) => {
                const selectedFile = (e.target as HTMLInputElement).files?.[0];
                if (selectedFile) {
                  handleFileSelect(selectedFile);
                }
              };
              input.click();
            }}
          >
            {file ? (
              <div className="space-y-2">
                {file.name.endsWith('.csv') ? (
                  <FileText className="h-12 w-12 mx-auto text-primary" />
                ) : (
                  <FileSpreadsheet className="h-12 w-12 mx-auto text-primary" />
                )}
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setParsedData([]);
                    setValidation(null);
                  }}
                >
                  Remove File
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-muted-foreground">
                  CSV or Excel (.csv, .xlsx, .xls)
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Ticket Type Strategy */}
      {parsedData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Ticket Type Management</CardTitle>
            <CardDescription>
              Choose how to handle ticket types for imported events
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup value={ticketTypeStrategy} onValueChange={(value: any) => setTicketTypeStrategy(value)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="auto" id="auto" />
                <Label htmlFor="auto" className="cursor-pointer">
                  <div>
                    <div className="font-medium">Auto-Create (Default)</div>
                    <div className="text-sm text-muted-foreground">
                      Automatically create new ticket types for each event
                    </div>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="reuse" id="reuse" />
                <Label htmlFor="reuse" className="cursor-pointer">
                  <div>
                    <div className="font-medium">Reuse Existing</div>
                    <div className="text-sm text-muted-foreground">
                      Reuse ticket type configurations if names match (case-insensitive)
                    </div>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="manual" id="manual" />
                <Label htmlFor="manual" className="cursor-pointer">
                  <div>
                    <div className="font-medium">Manual Selection</div>
                    <div className="text-sm text-muted-foreground">
                      Select which ticket types to reuse (coming soon)
                    </div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>
      )}

      {/* Validation Results */}
      {validation && (
        <Card>
          <CardHeader>
            <CardTitle>Validation Results</CardTitle>
            <CardDescription>
              Review the data before importing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {validation.errors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-destructive">
                  <XCircle className="h-5 w-5" />
                  <span className="font-semibold">
                    {validation.errors.length} Error{validation.errors.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="bg-destructive/10 rounded-lg p-4 space-y-1 max-h-40 overflow-y-auto">
                  {validation.errors.map((error, idx) => (
                    <div key={idx} className="text-sm">
                      <span className="font-medium">Row {error.row}:</span> {error.field} - {error.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {validation.warnings.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="font-semibold">
                    {validation.warnings.length} Warning{validation.warnings.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="bg-amber-50 rounded-lg p-4 space-y-1 max-h-40 overflow-y-auto">
                  {validation.warnings.map((warning, idx) => (
                    <div key={idx} className="text-sm">
                      <span className="font-medium">Row {warning.row}:</span> {warning.field} - {warning.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {validation.valid.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-semibold">
                    {validation.valid.length} Valid Event{validation.valid.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="bg-green-50 rounded-lg p-4 space-y-2 max-h-60 overflow-y-auto">
                  {validation.valid.map((event, idx) => (
                    <div key={idx} className="text-sm border-b pb-2 last:border-0">
                      <div className="font-medium">{event.event_name}</div>
                      <div className="text-muted-foreground">
                        {event.event_date} at {event.event_time} • {event.ticket_types.length} ticket type{event.ticket_types.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Import Button */}
      {validation && validation.valid.length > 0 && validation.errors.length === 0 && (
        <div className="flex justify-end">
          <Button
            onClick={executeBulkImport}
            disabled={importing}
            size="lg"
          >
            {importing ? "Importing..." : `Import ${validation.valid.length} Event${validation.valid.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      )}
    </div>
  );
}

