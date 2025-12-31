import { ArrowRight } from "lucide-react";

interface VenueCardProps {
  image: string;
  name: string;
  description: string;
}

const VenueCard = ({ image, name, description }: VenueCardProps) => {
  return (
    <div className="group relative overflow-hidden rounded-lg bg-card border border-border hover:border-primary transition-all duration-500 cursor-pointer animate-scale-in">
      {/* Image */}
      <div className="relative h-96 overflow-hidden">
        <img
          src={image}
          alt={name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent opacity-90 group-hover:opacity-95 transition-opacity"></div>
        
        {/* Overlay glow effect */}
        <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      </div>

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-8">
        <h3 className="text-3xl font-bold text-foreground mb-3 tracking-widest group-hover:text-primary transition-colors">
          {name}
        </h3>
        
        <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
          {description}
        </p>

        <div className="flex items-center gap-2 text-primary font-medium text-sm uppercase tracking-wider group-hover:gap-4 transition-all">
          <span>Explore</span>
          <ArrowRight className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};

export default VenueCard;
