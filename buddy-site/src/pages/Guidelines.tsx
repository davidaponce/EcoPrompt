import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/eco-button";
import { Separator } from "@/components/ui/separator";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Calculator, 
  Leaf, 
  Search, 
  Zap, 
  TreePine, 
  Droplets,
  Lightbulb,
  Target,
  TrendingDown
} from "lucide-react";

export const Guidelines = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-sky">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex items-center gap-3">
            <div className="gradient-forest p-2 rounded-lg shadow-glow">
              <Lightbulb className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">How EcoPrompt Works</h1>
              <p className="text-muted-foreground">Understanding our calculations and recommendations</p>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* The Problem */}
          <Card className="p-6 shadow-card">
            <div className="flex items-center gap-3 mb-4">
              <Target className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">The Problem We're Solving</h2>
            </div>
            <div className="space-y-4 text-muted-foreground">
              <p>
                AI chatbots like ChatGPT, Claude, and Gemini are incredibly powerful, but they come with a hidden environmental cost. 
                Each AI query requires massive neural networks with billions of parameters running on energy-intensive GPU clusters.
              </p>
              <div className="grid md:grid-cols-2 gap-4 my-6">
                <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Search className="h-4 w-4 text-success" />
                    <span className="font-medium text-success">Google Search</span>
                  </div>
                  <p className="text-sm">0.3-0.5 watt-hours per search</p>
                  <p className="text-sm">~0.04g CO₂ per search</p>
                  <p className="text-xs text-muted-foreground mt-1">Like riding a bike 🚴‍♀️</p>
                </div>
                <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-4 w-4 text-warning" />
                    <span className="font-medium text-warning">AI Chat Query</span>
                  </div>
                  <p className="text-sm">15-20 watt-hours per query</p>
                  <p className="text-sm">~0.5g CO₂ per 1000 tokens</p>
                  <p className="text-xs text-muted-foreground mt-1">Like driving a car 🚗</p>
                </div>
              </div>
              <p>
                <strong>The difference is significant:</strong> A single AI prompt can use 10-30x more energy than a Google search. 
                Both tools are valuable, but we should use the right tool for the right job.
              </p>
            </div>
          </Card>

          {/* How We Calculate */}
          <Card className="p-6 shadow-card">
            <div className="flex items-center gap-3 mb-4">
              <Calculator className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">How We Calculate Impact</h2>
            </div>
            <div className="space-y-6">
              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Leaf className="h-4 w-4 text-success" />
                  Token Estimation
                </h3>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">
                    We estimate tokens using the industry-standard ratio of approximately <strong>3.3 characters per token</strong> 
                    (based on GPT-4 tokenization patterns).
                  </p>
                  <div className="text-xs font-mono bg-card p-2 rounded border">
                    Estimated Tokens = Text Length ÷ 3.3
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-warning" />
                  CO₂ Emissions
                </h3>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">
                    Based on research from major AI providers, we use <strong>0.5g CO₂ per 1000 tokens</strong> 
                    for large language models (ChatGPT-4 class models).
                  </p>
                  <div className="text-xs font-mono bg-card p-2 rounded border">
                    CO₂ = (Tokens ÷ 1000) × 0.5g
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <TreePine className="h-4 w-4 text-success" />
                  Environmental Conversions
                </h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <div className="text-sm font-medium mb-1">Trees Saved</div>
                    <div className="text-xs text-muted-foreground">CO₂ × 0.0001 trees</div>
                    <div className="text-xs text-muted-foreground mt-1">Based on annual tree CO₂ absorption</div>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <div className="text-sm font-medium mb-1">Water Saved</div>
                    <div className="text-xs text-muted-foreground">CO₂ × 0.5 liters</div>
                    <div className="text-xs text-muted-foreground mt-1">Water used in energy production</div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Our Recommendations */}
          <Card className="p-6 shadow-card">
            <div className="flex items-center gap-3 mb-4">
              <Lightbulb className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">How We Help You Save Energy</h2>
            </div>
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  <Search className="h-4 w-4 text-accent-foreground" />
                  Smart Search Suggestions
                </h3>
                <p className="text-sm text-muted-foreground">
                  When we detect factual questions (containing phrases like "what is", "who is", "when did"), 
                  we suggest using Google instead. This can save up to 95% of the energy compared to AI chat.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-success" />
                  Prompt Optimization
                </h3>
                <p className="text-sm text-muted-foreground">
                  We automatically remove filler words and phrases ("please", "could you", "kindly") 
                  that don't add meaning but increase token count. Shorter prompts = less energy.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-primary" />
                  Real-time Feedback
                </h3>
                <p className="text-sm text-muted-foreground">
                  See the environmental impact of your prompts before sending them. 
                  We show comparisons to everyday actions like Google searches to make the impact tangible.
                </p>
              </div>
            </div>
          </Card>

          {/* Call to Action */}
          <Card className="p-6 shadow-card bg-gradient-forest text-white">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <TreePine className="h-12 w-12" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">Every Optimization Counts</h3>
                <p className="text-white/90 mt-2">
                  Small changes in how we use AI can have a big environmental impact. 
                  Together, we can make AI more sustainable without sacrificing productivity.
                </p>
              </div>
              <Button 
                variant="secondary" 
                onClick={() => navigate('/dashboard')}
                className="mt-4"
              >
                Start Optimizing Your Prompts
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};