import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/eco-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Leaf, 
  TreePine, 
  Droplets, 
  Zap, 
  Target, 
  Users, 
  Award,
  ArrowRight,
  Sparkles,
  Search,
  Brain,
  Globe
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import heroImage from "@/assets/hero-eco.jpg";

const Index = () => {
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
    };
    checkAuth();
  }, []);

  const handleGetStarted = () => {
    if (user) {
      navigate("/dashboard");
    } else {
      navigate("/auth");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-sky">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm bg-background/80">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="gradient-forest p-2 rounded-lg shadow-glow">
                <Leaf className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold text-foreground">EcoPrompt</span>
            </div>
            
            <div className="flex items-center gap-3">
              {user ? (
                <Button onClick={() => navigate("/dashboard")} variant="hero">
                  Go to Dashboard
                </Button>
              ) : (
                <>
                  <Button onClick={() => navigate("/auth")} variant="ghost">
                    Sign In
                  </Button>
                  <Button onClick={() => navigate("/auth")} variant="hero">
                    Get Started
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="space-y-4">
              <Badge variant="outline" className="gradient-achievement text-white border-none mb-4">
                <Globe className="h-3 w-3 mr-1" />
                Save the Planet, One Prompt at a Time
              </Badge>
              
              <h1 className="text-5xl md:text-7xl font-bold text-foreground leading-tight">
                Make AI Usage
                <br />
                <span className="gradient-forest bg-clip-text text-transparent">
                  Sustainable
                </span>
              </h1>
              
              <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
                Track your AI carbon footprint, get smart suggestions for eco-friendly prompting, 
                and compete with friends to save the planet.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button onClick={handleGetStarted} variant="hero" size="xl" className="text-lg">
                <Sparkles className="h-5 w-5 mr-2" />
                Start Saving CO₂
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
              <Button variant="outline" size="xl" className="text-lg">
                <Target className="h-5 w-5 mr-2" />
                Learn How It Works
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Hero Image */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="relative rounded-2xl overflow-hidden shadow-card max-w-4xl mx-auto">
            <img 
              src={heroImage} 
              alt="Eco-friendly AI concept showing nature and technology in harmony" 
              className="w-full h-96 object-cover"
            />
            <div className="absolute inset-0 gradient-earth opacity-30"></div>
            <div className="absolute bottom-6 left-6 right-6">
              <Card className="p-4 bg-background/90 backdrop-blur-sm">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-primary">20x</div>
                    <div className="text-sm text-muted-foreground">Less Energy</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-success">95%</div>
                    <div className="text-sm text-muted-foreground">CO₂ Reduction</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-warning">Smart</div>
                    <div className="text-sm text-muted-foreground">Suggestions</div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-4">
              How EcoPrompt Works
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Our intelligent system helps you make eco-conscious choices every time you use AI
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <Card className="p-8 text-center shadow-card hover:shadow-soft transition-smooth">
              <div className="gradient-forest p-4 rounded-full w-16 h-16 mx-auto mb-6 shadow-glow">
                <Brain className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">Smart Analysis</h3>
              <p className="text-muted-foreground mb-4">
                Analyze your prompts for CO₂ impact and get instant suggestions for more efficient alternatives.
              </p>
              <Badge variant="outline" className="gradient-forest text-white border-none">
                AI-Powered
              </Badge>
            </Card>

            <Card className="p-8 text-center shadow-card hover:shadow-soft transition-smooth">
              <div className="gradient-achievement p-4 rounded-full w-16 h-16 mx-auto mb-6 shadow-glow">
                <Search className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">Search Suggestions</h3>
              <p className="text-muted-foreground mb-4">
                Get recommendations to use Google search for simple questions instead of energy-intensive AI.
              </p>
              <Badge variant="outline" className="gradient-achievement text-white border-none">
                20x Greener
              </Badge>
            </Card>

            <Card className="p-8 text-center shadow-card hover:shadow-soft transition-smooth">
              <div className="gradient-earth p-4 rounded-full w-16 h-16 mx-auto mb-6 shadow-glow">
                <Users className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">Gamified Impact</h3>
              <p className="text-muted-foreground mb-4">
                Earn eco-coins, unlock achievements, and compete with friends on the leaderboard.
              </p>
              <Badge variant="outline" className="gradient-earth text-white border-none">
                Social Impact
              </Badge>
            </Card>
          </div>
        </div>
      </section>

      {/* Impact Stats */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-12">
            Your Impact Matters
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            <div className="space-y-2">
              <div className="gradient-forest p-3 rounded-lg mx-auto w-fit shadow-soft">
                <Leaf className="h-6 w-6 text-white" />
              </div>
              <div className="text-3xl font-bold text-foreground">CO₂ Saved</div>
              <div className="text-sm text-muted-foreground">Reduce carbon emissions</div>
            </div>
            
            <div className="space-y-2">
              <div className="gradient-earth p-3 rounded-lg mx-auto w-fit shadow-soft">
                <TreePine className="h-6 w-6 text-white" />
              </div>
              <div className="text-3xl font-bold text-foreground">Trees</div>
              <div className="text-sm text-muted-foreground">Equivalent trees saved</div>
            </div>
            
            <div className="space-y-2">
              <div className="gradient-sky p-3 rounded-lg mx-auto w-fit shadow-soft">
                <Droplets className="h-6 w-6 text-white" />
              </div>
              <div className="text-3xl font-bold text-foreground">Water</div>
              <div className="text-sm text-muted-foreground">Liters conserved</div>
            </div>
            
            <div className="space-y-2">
              <div className="gradient-achievement p-3 rounded-lg mx-auto w-fit shadow-soft">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <div className="text-3xl font-bold text-foreground">Energy</div>
              <div className="text-sm text-muted-foreground">Watts saved</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container mx-auto px-4 text-center">
          <Card className="p-12 max-w-2xl mx-auto shadow-card">
            <div className="gradient-forest p-4 rounded-full w-20 h-20 mx-auto mb-6 shadow-glow">
              <Globe className="h-12 w-12 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Ready to Make a Difference?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Join thousands of users who are already making their AI usage more sustainable.
            </p>
            <Button onClick={handleGetStarted} variant="hero" size="xl" className="text-lg">
              <Award className="h-5 w-5 mr-2" />
              Start Your Eco Journey
            </Button>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="gradient-forest p-1.5 rounded-lg">
              <Leaf className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-foreground">EcoPrompt</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Making AI more sustainable, one prompt at a time. 🌱
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
