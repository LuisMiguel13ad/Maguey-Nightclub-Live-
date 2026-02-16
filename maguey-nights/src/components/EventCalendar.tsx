import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Event data structure
interface Event {
  id: string;
  title: string;
  artist: string;
  date: Date;
  venue: string;
  image: string;
  type: 'concert' | 'nightclub' | 'after-hours' | 'special';
  description?: string;
}

// Sample event data
const events: Event[] = [
  // October 2024 Events
  {
    id: '1',
    title: 'RICK ROSS LIVE IN CONCERT',
    artist: 'Rick Ross',
    date: new Date(2024, 9, 24), // October 24, 2024
    venue: 'Main Stage',
    image: '/src/assets/event-reggaeton.jpg',
    type: 'concert',
    description: 'Live performance by the legendary Rick Ross'
  },
  {
    id: '2',
    title: 'LIL WAYNE LIVE IN CONCERT',
    artist: 'Lil Wayne',
    date: new Date(2024, 9, 25), // October 25, 2024
    venue: 'Main Stage',
    image: '/src/assets/event-champagne.jpg',
    type: 'concert',
    description: 'Live performance by the iconic Lil Wayne'
  },
  {
    id: '3',
    title: 'WAKA FLOCKA LIVE IN CONCERT',
    artist: 'Waka Flocka',
    date: new Date(2024, 9, 26), // October 26, 2024
    venue: 'Main Stage',
    image: '/src/assets/event-fiesta.jpg',
    type: 'concert',
    description: 'Live performance by Waka Flocka Flame'
  },
  {
    id: '4',
    title: 'after hours',
    artist: 'DJ Sessions',
    date: new Date(2024, 9, 23), // October 23, 2024
    venue: 'VIP Lounge',
    image: '/src/assets/venue-vip.jpg',
    type: 'after-hours',
    description: 'Late night DJ sessions in the VIP Lounge'
  },
  {
    id: '5',
    title: 'after hours',
    artist: 'DJ Sessions',
    date: new Date(2024, 9, 24), // October 24, 2024
    venue: 'VIP Lounge',
    image: '/src/assets/venue-vip.jpg',
    type: 'after-hours',
    description: 'Late night DJ sessions in the VIP Lounge'
  },
  {
    id: '6',
    title: 'after hours',
    artist: 'DJ Sessions',
    date: new Date(2024, 9, 25), // October 25, 2024
    venue: 'VIP Lounge',
    image: '/src/assets/venue-vip.jpg',
    type: 'after-hours',
    description: 'Late night DJ sessions in the VIP Lounge'
  },
  {
    id: '7',
    title: 'Simp City',
    artist: 'R&B Night',
    date: new Date(2024, 9, 30), // October 30, 2024
    venue: 'Patio Bar',
    image: '/src/assets/venue-patio.jpg',
    type: 'special',
    description: 'THE HOTTEST R&B PARTY IN DELAWARE'
  },
  {
    id: '8',
    title: '50 LIVE IN CONCERT',
    artist: '50 Cent',
    date: new Date(2024, 9, 31), // October 31, 2024
    venue: 'Main Stage',
    image: '/src/assets/venue-mainstage.jpg',
    type: 'concert',
    description: 'Live performance by 50 Cent'
  },
  
  // November 2024 Events
  {
    id: '9',
    title: 'MAGUEY NIGHTCLUB',
    artist: 'Regular Night',
    date: new Date(2024, 10, 1), // November 1, 2024
    venue: 'Main Stage',
    image: '/src/assets/venue-mainstage.jpg',
    type: 'nightclub',
    description: 'Regular nightclub operations'
  },
  {
    id: '10',
    title: 'MAGUEY NIGHTCLUB',
    artist: 'Regular Night',
    date: new Date(2024, 10, 2), // November 2, 2024
    venue: 'Main Stage',
    image: '/src/assets/venue-mainstage.jpg',
    type: 'nightclub',
    description: 'Regular nightclub operations'
  },
  {
    id: '11',
    title: 'DJ REGGAETÓN NIGHTS',
    artist: 'DJ Sessions',
    date: new Date(2024, 10, 1), // November 1, 2024
    venue: 'Main Stage',
    image: '/src/assets/event-reggaeton.jpg',
    type: 'special',
    description: 'The hottest reggaeton night in Delaware'
  },
  {
    id: '12',
    title: 'CHAMPAGNE SUNDAYS',
    artist: 'VIP Experience',
    date: new Date(2024, 10, 2), // November 2, 2024
    venue: 'VIP Lounge',
    image: '/src/assets/event-champagne.jpg',
    type: 'special',
    description: 'Premium champagne service and VIP experience'
  },
  {
    id: '13',
    title: 'LA FIESTA LATINA',
    artist: 'Latin Night',
    date: new Date(2024, 10, 8), // November 8, 2024
    venue: 'Patio Bar',
    image: '/src/assets/event-fiesta.jpg',
    type: 'special',
    description: 'Authentic Latin music and culture celebration'
  },
  
  // December 2024 Events
  {
    id: '14',
    title: 'DRAKE LIVE IN CONCERT',
    artist: 'Drake',
    date: new Date(2024, 11, 15), // December 15, 2024
    venue: 'Main Stage',
    image: '/src/assets/venue-mainstage.jpg',
    type: 'concert',
    description: 'Live performance by Drake'
  },
  {
    id: '15',
    title: 'NEW YEAR\'S EVE BASH',
    artist: 'Special Event',
    date: new Date(2024, 11, 31), // December 31, 2024
    venue: 'All Venues',
    image: '/src/assets/venue-mainstage.jpg',
    type: 'special',
    description: 'The biggest New Year\'s Eve celebration in Delaware'
  },
  
  // January 2025 Events
  {
    id: '16',
    title: 'BENZINO LIVE IN CONCERT',
    artist: 'Benzino',
    date: new Date(2025, 0, 10), // January 10, 2025
    venue: 'Main Stage',
    image: '/src/assets/venue-mainstage.jpg',
    type: 'concert',
    description: 'Live performance by Benzino'
  },
  {
    id: '17',
    title: 'MAGUEY NIGHTCLUB',
    artist: 'Regular Night',
    date: new Date(2025, 0, 15), // January 15, 2025
    venue: 'Main Stage',
    image: '/src/assets/venue-mainstage.jpg',
    type: 'nightclub',
    description: 'Regular nightclub operations'
  }
];

const EventCalendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Get the first day of the current month and calculate the start of the calendar grid
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const startOfCalendar = new Date(firstDayOfMonth);
  startOfCalendar.setDate(startOfCalendar.getDate() - firstDayOfMonth.getDay());
  
  // Generate calendar days
  const calendarDays = [];
  for (let i = 0; i < 42; i++) { // 6 weeks * 7 days
    const date = new Date(startOfCalendar);
    date.setDate(startOfCalendar.getDate() + i);
    calendarDays.push(date);
  }
  
  // Get events for a specific date
  const getEventsForDate = (date: Date) => {
    return events.filter(event => 
      event.date.getDate() === date.getDate() &&
      event.date.getMonth() === date.getMonth() &&
      event.date.getFullYear() === date.getFullYear()
    );
  };
  
  // Navigate months
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  
  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };
  
  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    }).toUpperCase();
  };
  
  const formatDayOfWeek = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  };
  
  const monthNames = [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
  ];
  
  return (
    <div className="w-full">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl md:text-4xl font-bold text-primary tracking-widest">
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h2>
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            onClick={goToPreviousMonth}
            className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={goToNextMonth}
            className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      {/* Calendar Grid */}
      <div className="bg-card border-2 border-border rounded-xl overflow-hidden shadow-2xl">
        {/* Days of week header */}
        <div className="grid grid-cols-7 bg-gradient-to-r from-background to-card border-b-2 border-border">
          {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day) => (
            <div key={day} className="p-4 text-center font-bold text-foreground border-r border-border last:border-r-0 bg-background/50">
              {day}
            </div>
          ))}
        </div>
        
        {/* Calendar days */}
        <div className="grid grid-cols-7">
          {calendarDays.map((date, index) => {
            const dayEvents = getEventsForDate(date);
            const isCurrentMonth = date.getMonth() === currentDate.getMonth();
            const isToday = date.toDateString() === new Date().toDateString();
            
            return (
              <div
                key={index}
                className={`min-h-[140px] border-r border-b border-border last:border-r-0 p-3 ${
                  !isCurrentMonth ? 'bg-muted/20 text-muted-foreground' : 'bg-card'
                } ${isToday ? 'bg-primary/20 border-primary/50' : ''} hover:bg-muted/10 transition-colors`}
              >
                {/* Date header */}
                <div className={`text-sm font-bold mb-3 px-2 py-1 rounded-md ${
                  isToday ? 'text-primary bg-primary/20' : isCurrentMonth ? 'text-foreground bg-background/50' : 'text-muted-foreground'
                }`}>
                  {formatDate(date)}
                </div>
                
                {/* Events */}
                <div className="space-y-2">
                  {dayEvents.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Event card component for calendar
const EventCard = ({ event }: { event: Event }) => {
  const getEventStyle = (type: Event['type']) => {
    switch (type) {
      case 'concert':
        return {
          bg: 'bg-gradient-to-br from-yellow-600 via-yellow-500 to-yellow-400',
          text: 'text-black',
          border: 'border-yellow-300',
          glow: 'shadow-yellow-500/20'
        };
      case 'after-hours':
        return {
          bg: 'bg-gradient-to-br from-red-700 via-red-600 to-red-500',
          text: 'text-white',
          border: 'border-red-400',
          glow: 'shadow-red-500/20'
        };
      case 'special':
        return {
          bg: 'bg-gradient-to-br from-purple-700 via-purple-600 to-purple-500',
          text: 'text-white',
          border: 'border-purple-400',
          glow: 'shadow-purple-500/20'
        };
      case 'nightclub':
        return {
          bg: 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700',
          text: 'text-white',
          border: 'border-gray-500',
          glow: 'shadow-gray-500/20'
        };
      default:
        return {
          bg: 'bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500',
          text: 'text-white',
          border: 'border-blue-400',
          glow: 'shadow-blue-500/20'
        };
    }
  };
  
  const style = getEventStyle(event.type);
  
  return (
    <Card className={`p-2 cursor-pointer hover:scale-105 transition-all duration-300 ${style.bg} ${style.text} ${style.border} border-2 shadow-lg hover:shadow-xl ${style.glow} hover:shadow-2xl`}>
      <div className="text-xs font-bold truncate mb-1">
        {event.title}
      </div>
      <div className="text-xs opacity-90 truncate">
        {event.venue}
      </div>
      {event.type === 'after-hours' && (
        <div className="text-xs font-semibold mt-1 opacity-80">
          {event.date.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()}
        </div>
      )}
    </Card>
  );
};

export default EventCalendar;
