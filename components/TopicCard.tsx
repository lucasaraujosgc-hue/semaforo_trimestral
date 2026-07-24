import React from 'react';
import { TopicDef } from '../types';
import * as LucideIcons from 'lucide-react';

interface TopicCardProps {
  topic: TopicDef;
  onClick: (id: string) => void;
}

export const TopicCard: React.FC<TopicCardProps> = ({ topic, onClick }) => {
  // Dynamically access the icon component
  const IconComponent = (LucideIcons as any)[topic.iconName] || LucideIcons.HelpCircle;

  return (
    <button
      onClick={() => onClick(topic.id)}
      className="flex flex-col items-center justify-center p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100 hover:border-blue-200 group text-center h-full"
    >
      <div className={`p-4 rounded-full ${topic.color} bg-opacity-10 mb-4 group-hover:scale-110 transition-transform duration-300`}>
        <IconComponent className={`w-8 h-8 ${topic.color.replace('bg-', 'text-')}`} />
      </div>
      <h3 className="text-lg font-bold text-gray-800 mb-2">{topic.label}</h3>
      <p className="text-sm text-gray-500 line-clamp-2">{topic.description}</p>
    </button>
  );
};