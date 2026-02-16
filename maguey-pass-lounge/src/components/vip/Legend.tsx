import React from 'react';

const Legend: React.FC = () => {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-xs sm:text-sm">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-md bg-amber-500/10 border-2 border-amber-500" />
        <span className="text-gray-400">Premium ($750)</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-md bg-purple-500/10 border-2 border-purple-500" />
        <span className="text-gray-400">Standard ($700)</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-md bg-blue-500/10 border-2 border-blue-500" />
        <span className="text-gray-400">Regular ($600)</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-md bg-gray-500/20 border-2 border-gray-600 opacity-40" />
        <span className="text-gray-500">Reserved</span>
      </div>
    </div>
  );
};

export default Legend;

