import { Card } from "@/components/ui/card";
import { Leaf, Droplets, TreePine, Zap } from "lucide-react";

interface EcoStatsProps {
  co2Saved: number;
  treesSaved: number;
  waterSaved: number;
  energySaved: number;
}

export const EcoStats = ({ co2Saved, treesSaved, waterSaved, energySaved }: EcoStatsProps) => {
  const stats = [
    {
      icon: Leaf,
      value: `${co2Saved.toFixed(1)}g`,
      label: "CO₂ Saved",
      description: "Carbon emissions reduced",
      gradient: "gradient-forest",
    },
    {
      icon: TreePine,
      value: `${treesSaved.toFixed(2)}`,
      label: "Trees Saved",
      description: "Equivalent trees preserved",
      gradient: "gradient-earth",
    },
    {
      icon: Droplets,
      value: `${waterSaved.toFixed(1)}L`,
      label: "Water Saved",
      description: "Water resources conserved",
      gradient: "gradient-water",
    },
    {
      icon: Zap,
      value: `${energySaved.toFixed(1)}Wh`,
      label: "Energy Saved",
      description: "Power consumption reduced",
      gradient: "gradient-achievement",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <Card key={index} className="p-4 shadow-card hover:shadow-soft transition-smooth">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${stat.gradient}`}>
              <stat.icon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="text-lg font-bold text-foreground">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">{stat.description}</p>
        </Card>
      ))}
    </div>
  );
};