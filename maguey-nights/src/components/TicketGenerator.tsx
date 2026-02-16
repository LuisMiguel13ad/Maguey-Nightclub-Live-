import React from 'react';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

interface TicketData {
  orderId: string;
  event: {
    artist: string;
    date: string;
    time: string;
    venue: string;
    address: string;
  };
  customer: {
    firstName: string;
    lastName: string;
    email: string;
  };
  tickets: {[key: string]: number};
  tables: {[key: string]: number};
  total: number;
  qrCode: string;
}

interface TicketGeneratorProps {
  ticketData: TicketData;
  onGenerated?: (pdfUrl: string) => void;
}

const TicketGenerator: React.FC<TicketGeneratorProps> = ({ ticketData, onGenerated }) => {
  const generateQRCode = async (data: string): Promise<string> => {
    try {
      const qrCodeDataURL = await QRCode.toDataURL(data, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      return qrCodeDataURL;
    } catch (error) {
      console.error('Error generating QR code:', error);
      return '';
    }
  };

  const generateTicket = async () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [85, 55] // Standard ticket size
      });

      // Generate QR code
      const qrData = `${ticketData.orderId}|${ticketData.event.artist}|${ticketData.event.date}`;
      const qrCodeDataURL = await generateQRCode(qrData);

      // Set up fonts and colors
      doc.setFont('helvetica');
      
      // Background gradient effect
      doc.setFillColor(0, 0, 0);
      doc.rect(0, 0, 85, 55, 'F');

      // Header with club name
      doc.setFillColor(57, 181, 74); // Maguey green
      doc.rect(0, 0, 85, 12, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('MAGUEY', 42, 8, { align: 'center' });
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('DELAWARE', 42, 11, { align: 'center' });

      // Event details
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(ticketData.event.artist, 5, 18);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(ticketData.event.date, 5, 22);
      doc.text(ticketData.event.time, 5, 25);
      doc.text(ticketData.event.venue, 5, 28);

      // Customer info
      doc.setFontSize(7);
      doc.text(`${ticketData.customer.firstName} ${ticketData.customer.lastName}`, 5, 32);
      doc.text(ticketData.customer.email, 5, 35);

      // Ticket details
      let yPos = 38;
      Object.entries(ticketData.tickets).forEach(([ticketId, quantity]) => {
        if (quantity > 0) {
          doc.setFontSize(7);
          doc.text(`Ticket x${quantity}`, 5, yPos);
          yPos += 3;
        }
      });

      Object.entries(ticketData.tables).forEach(([tableId, quantity]) => {
        if (quantity > 0) {
          doc.setFontSize(7);
          doc.text(`Table x${quantity}`, 5, yPos);
          yPos += 3;
        }
      });

      // QR Code
      if (qrCodeDataURL) {
        doc.addImage(qrCodeDataURL, 'PNG', 60, 15, 20, 20);
      }

      // Order ID
      doc.setFontSize(6);
      doc.setTextColor(200, 200, 200);
      doc.text(`Order: ${ticketData.orderId}`, 5, 50);
      doc.text(`Total: $${ticketData.total.toFixed(2)}`, 5, 53);

      // Footer
      doc.setFontSize(5);
      doc.text('Present this ticket at entry', 42, 50, { align: 'center' });
      doc.text('Valid ID required • 21+ Only', 42, 53, { align: 'center' });

      // Generate PDF blob
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      
      if (onGenerated) {
        onGenerated(pdfUrl);
      }

      return pdfUrl;
    } catch (error) {
      console.error('Error generating ticket:', error);
      throw error;
    }
  };

  // Auto-generate ticket when component mounts
  React.useEffect(() => {
    generateTicket();
  }, [ticketData]);

  return null;
};

export default TicketGenerator;

// Utility function to create ticket data
export const createTicketData = (order: any): TicketData => {
  return {
    orderId: order.orderId,
    event: {
      artist: order.event.artist,
      date: order.event.date,
      time: order.event.time,
      venue: order.event.venue,
      address: order.event.address
    },
    customer: {
      firstName: order.customer.firstName,
      lastName: order.customer.lastName,
      email: order.customer.email
    },
    tickets: order.tickets,
    tables: order.tables,
    total: order.total,
    qrCode: `${order.orderId}|${order.event.artist}|${order.event.date}`
  };
};
