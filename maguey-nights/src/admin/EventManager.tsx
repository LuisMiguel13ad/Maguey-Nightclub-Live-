import { useState, useEffect } from 'react';
import { events, Event, getEventById } from '../data/events';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const EventManager = () => {
  const [allEvents, setAllEvents] = useState<Event[]>(events);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const handleSave = (eventData: Event) => {
    if (editingEvent) {
      // Update existing event
      setAllEvents(prev => 
        prev.map(event => event.id === eventData.id ? eventData : event)
      );
    } else {
      // Add new event
      const newEvent = { ...eventData, id: Date.now().toString() };
      setAllEvents(prev => [...prev, newEvent]);
    }
    setEditingEvent(null);
    setIsAdding(false);
  };

  const handleDelete = (eventId: string) => {
    setAllEvents(prev => prev.filter(event => event.id !== eventId));
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(allEvents, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'events.json';
    link.click();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Event Manager</h1>
        <div className="space-x-2">
          <Button onClick={() => setIsAdding(true)}>Add Event</Button>
          <Button onClick={handleExport} variant="outline">Export JSON</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {allEvents.map((event) => (
          <Card key={event.id} className="bg-gray-900 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white text-lg">{event.artist}</CardTitle>
              <p className="text-gray-400 text-sm">{event.date}</p>
            </CardHeader>
            <CardContent>
              <p className="text-gray-300 text-sm mb-2">{event.description}</p>
              <p className="text-green-400 font-semibold">{event.price}</p>
              <div className="flex space-x-2 mt-4">
                <Button 
                  size="sm" 
                  onClick={() => setEditingEvent(event)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Edit
                </Button>
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={() => handleDelete(event.id)}
                >
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add/Edit Modal would go here */}
      {(editingEvent || isAdding) && (
        <EventForm 
          event={editingEvent} 
          onSave={handleSave}
          onCancel={() => {
            setEditingEvent(null);
            setIsAdding(false);
          }}
        />
      )}
    </div>
  );
};

// Simple form component for adding/editing events
const EventForm = ({ event, onSave, onCancel }: {
  event: Event | null;
  onSave: (event: Event) => void;
  onCancel: () => void;
}) => {
  const [formData, setFormData] = useState<Event>(event || {
    id: '',
    artist: '',
    date: '',
    time: '',
    price: '',
    description: '',
    features: [],
    venue: 'MAGUEY DELAWARE',
    address: '123 Main Street, Wilmington, DE 19801',
    image: '',
    eventId: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl bg-gray-900 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">
            {event ? 'Edit Event' : 'Add New Event'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              placeholder="Artist/Event Name"
              value={formData.artist}
              onChange={(e) => setFormData({...formData, artist: e.target.value})}
              className="bg-gray-800 border-gray-600 text-white"
            />
            <Input
              placeholder="Date (e.g., OCT 25 FRIDAY)"
              value={formData.date}
              onChange={(e) => setFormData({...formData, date: e.target.value})}
              className="bg-gray-800 border-gray-600 text-white"
            />
            <Input
              placeholder="Time (e.g., 10:00 PM - 3:00 AM)"
              value={formData.time}
              onChange={(e) => setFormData({...formData, time: e.target.value})}
              className="bg-gray-800 border-gray-600 text-white"
            />
            <Input
              placeholder="Price (e.g., $30 - $60)"
              value={formData.price}
              onChange={(e) => setFormData({...formData, price: e.target.value})}
              className="bg-gray-800 border-gray-600 text-white"
            />
            <Textarea
              placeholder="Event Description"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="bg-gray-800 border-gray-600 text-white"
            />
            <div className="flex space-x-2">
              <Button type="submit" className="bg-green-600 hover:bg-green-700">
                Save
              </Button>
              <Button type="button" onClick={onCancel} variant="outline">
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default EventManager;
