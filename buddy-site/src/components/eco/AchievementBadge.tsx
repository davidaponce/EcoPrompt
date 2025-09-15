import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Award, Target, Zap, Users, Leaf, TreePine } from "lucide-react";

export type AchievementType = 
  | "green_choice" 
  | "prompt_trimmer" 
  | "balanced_thinker"
  | "eco_warrior" 
  | "forest_guardian"
  | "energy_saver";

interface Achievement {
  id: AchievementType;
  title: string;
  description: string;
  icon: any;
  gradient: string;
  progress?: number;
  maxProgress?: number;
  unlocked: boolean;
}

const achievementData: Record<AchievementType, Omit<Achievement, 'unlocked' | 'progress' | 'maxProgress'>> = {
  green_choice: {
    id: "green_choice",
    title: "Green Choice",
    description: "Chose Google over AI 10 times",
    icon: Leaf,
    gradient: "gradient-forest",
  },
  prompt_trimmer: {
    id: "prompt_trimmer",
    title: "Prompt Trimmer",
    description: "Reduced average prompt length by 20%",
    icon: Zap,
    gradient: "gradient-achievement",
  },
  balanced_thinker: {
    id: "balanced_thinker",
    title: "Balanced Thinker",
    description: "50/50 mix of AI and search usage",
    icon: Target,
    gradient: "gradient-earth",
  },
  eco_warrior: {
    id: "eco_warrior",
    title: "Eco Warrior",
    description: "Saved 100g CO₂ in total",
    icon: Award,
    gradient: "gradient-sky",
  },
  forest_guardian: {
    id: "forest_guardian",
    title: "Forest Guardian",
    description: "Saved equivalent of 1 tree",
    icon: TreePine,
    gradient: "gradient-forest",
  },
  energy_saver: {
    id: "energy_saver",
    title: "Energy Saver",
    description: "Invite 5 friends to join",
    icon: Users,
    gradient: "gradient-achievement",
  },
};

interface AchievementBadgeProps {
  type: AchievementType;
  unlocked?: boolean;
  progress?: number;
  maxProgress?: number;
  size?: "sm" | "md" | "lg";
}

export const AchievementBadge = ({ 
  type, 
  unlocked = false, 
  progress = 0, 
  maxProgress = 100,
  size = "md" 
}: AchievementBadgeProps) => {
  const achievement = achievementData[type];
  const progressPercent = Math.min((progress / maxProgress) * 100, 100);
  
  const sizeClasses = {
    sm: "p-2",
    md: "p-4", 
    lg: "p-6"
  };
  
  const iconSizes = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8"
  };

  return (
    <Card className={`${sizeClasses[size]} shadow-card hover:shadow-soft transition-smooth ${unlocked ? 'ring-2 ring-success/20' : 'opacity-75'}`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${unlocked ? achievement.gradient : 'bg-muted'} ${unlocked ? 'shadow-glow' : ''}`}>
          <achievement.icon className={`${iconSizes[size]} ${unlocked ? 'text-white' : 'text-muted-foreground'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className={`font-medium truncate ${unlocked ? 'text-foreground' : 'text-muted-foreground'}`}>
              {achievement.title}
            </h4>
            {unlocked && <Badge variant="outline" className="text-xs gradient-achievement text-white">Unlocked!</Badge>}
          </div>
          <p className="text-sm text-muted-foreground truncate">{achievement.description}</p>
          
          {!unlocked && maxProgress > 0 && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{progress}/{maxProgress}</span>
                <span>{progressPercent.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5">
                <div 
                  className="gradient-forest h-1.5 rounded-full transition-all duration-300" 
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

export { achievementData };