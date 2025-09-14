import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/eco-button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Leaf, 
  TreePine, 
  Trophy, 
  Target, 
  LogOut, 
  User,
  BarChart3,
  Settings,
  Crown
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EcoStats } from "@/components/eco/EcoStats";
import { PromptAnalyzer } from "@/components/eco/PromptAnalyzer";
import { AchievementBadge, achievementData, type AchievementType } from "@/components/eco/AchievementBadge";

interface UserProfile {
  id: string;
  display_name: string;
  username: string;
  total_co2_saved: number;
  total_trees_saved: number;
  total_water_saved: number;
  total_energy_saved: number;
  eco_currency: number;
}

export const Dashboard = () => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [achievements, setAchievements] = useState<Record<AchievementType, any>>({} as Record<AchievementType, any>);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      navigate("/");
      return;
    }

    setUser(session.user);
    await loadUserProfile(session.user.id);
    setLoading(false);

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT') {
          navigate("/");
        } else if (session?.user) {
          setUser(session.user);
          loadUserProfile(session.user.id);
        }
      }
    );

    return () => subscription.unsubscribe();
  };

  const loadUserProfile = async (userId: string) => {
    try {
      // Load profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (profileError) {
        console.error('Profile error:', profileError);
      } else {
        setProfile(profileData);
      }

      // Load achievements
      const { data: achievementsData, error: achievementsError } = await supabase
        .from('achievements')
        .select('*')
        .eq('user_id', userId);

      if (achievementsError) {
        console.error('Achievements error:', achievementsError);
      } else {
        const achievementsMap = achievementsData.reduce((acc, achievement) => {
          acc[achievement.achievement_type as AchievementType] = achievement;
          return acc;
        }, {} as Record<AchievementType, any>);
        setAchievements(achievementsMap);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Signed out successfully! 👋",
      description: "Thanks for helping save the planet today",
    });
  };

  const handleCO2Save = async (amount: number) => {
    if (!user || !profile) return;

    try {
      // Record the eco action
      await supabase.from('eco_actions').insert({
        user_id: user.id,
        action_type: 'search_used',
        co2_saved: amount,
        trees_saved: amount * 0.0001, // Rough conversion
        water_saved: amount * 0.5,
        energy_saved: amount * 2,
      });

      // Update profile totals
      const newCO2Total = (profile.total_co2_saved || 0) + amount;
      const newTreesTotal = (profile.total_trees_saved || 0) + (amount * 0.0001);
      const newWaterTotal = (profile.total_water_saved || 0) + (amount * 0.5);
      const newEnergyTotal = (profile.total_energy_saved || 0) + (amount * 2);
      const newCurrency = (profile.eco_currency || 0) + Math.floor(amount * 10);

      await supabase
        .from('profiles')
        .update({
          total_co2_saved: newCO2Total,
          total_trees_saved: newTreesTotal,
          total_water_saved: newWaterTotal,
          total_energy_saved: newEnergyTotal,
          eco_currency: newCurrency,
        })
        .eq('user_id', user.id);

      // Reload profile to refresh state
      await loadUserProfile(user.id);
      
      // Check and unlock achievements
      await checkAndUnlockAchievements(user.id, newCO2Total, newTreesTotal, newWaterTotal, newEnergyTotal, newCurrency);

    } catch (error) {
      console.error('Error saving CO2 data:', error);
    }
  };

  const checkAndUnlockAchievements = async (userId: string, co2Total: number, treesTotal: number, waterTotal: number, energyTotal: number, currency: number) => {
    try {
      const achievementChecks = [
        { type: 'first_save', condition: co2Total >= 0.1, maxProgress: 1 },
        { type: 'eco_warrior', condition: co2Total >= 10, maxProgress: 10 },
        { type: 'tree_hugger', condition: treesTotal >= 0.01, maxProgress: 0.01 },
        { type: 'water_saver', condition: waterTotal >= 50, maxProgress: 50 },
        { type: 'energy_efficient', condition: energyTotal >= 100, maxProgress: 100 },
        { type: 'prompt_master', condition: currency >= 100, maxProgress: 100 },
      ];

      for (const check of achievementChecks) {
        if (check.condition) {
          // Check if achievement already exists
          const { data: existingAchievement } = await supabase
            .from('achievements')
            .select('*')
            .eq('user_id', userId)
            .eq('achievement_type', check.type)
            .single();

          if (!existingAchievement) {
            // Unlock the achievement
            await supabase.from('achievements').insert({
              user_id: userId,
              achievement_type: check.type,
              progress: check.maxProgress,
              max_progress: check.maxProgress,
            });

            // Show toast notification
            toast({
              title: "🏆 Achievement Unlocked!",
              description: `You've earned the ${check.type.replace('_', ' ')} achievement!`,
            });
          }
        }
      }
    } catch (error) {
      console.error('Error checking achievements:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-sky flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin gradient-forest p-4 rounded-full w-16 h-16 mx-auto">
            <Leaf className="h-8 w-8 text-white" />
          </div>
          <p className="text-muted-foreground">Loading your eco dashboard...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-sky flex items-center justify-center">
        <Card className="p-6 text-center">
          <p>Unable to load profile. Please try refreshing.</p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Refresh
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-sky">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="gradient-forest p-2 rounded-lg shadow-glow">
              <Leaf className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">EcoPrompt</h1>
              <p className="text-muted-foreground">Welcome back, {profile.display_name}!</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gradient-achievement text-white border-none">
              <Crown className="h-3 w-3 mr-1" />
              {profile.eco_currency} Eco Coins
            </Badge>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="mb-8">
          <EcoStats
            co2Saved={profile.total_co2_saved || 0}
            treesSaved={profile.total_trees_saved || 0}
            waterSaved={profile.total_water_saved || 0}
            energySaved={profile.total_energy_saved || 0}
          />
        </div>

        {/* Main Content */}
        <Tabs defaultValue="analyzer" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="analyzer">
              <Target className="h-4 w-4 mr-2" />
              Analyzer
            </TabsTrigger>
            <TabsTrigger value="achievements">
              <Trophy className="h-4 w-4 mr-2" />
              Achievements
            </TabsTrigger>
            <TabsTrigger value="guidelines">
              <Settings className="h-4 w-4 mr-2" />
              Guidelines
            </TabsTrigger>
            <TabsTrigger value="leaderboard">
              <BarChart3 className="h-4 w-4 mr-2" />
              Leaderboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analyzer">
            <PromptAnalyzer onCO2Save={handleCO2Save} />
          </TabsContent>

          <TabsContent value="achievements">
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  Your Achievements
                </h3>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.keys(achievementData).map((type) => {
                    const achievementType = type as AchievementType;
                    const userAchievement = achievements[achievementType];
                    const isUnlocked = !!userAchievement;
                    
                    return (
                      <AchievementBadge
                        key={type}
                        type={achievementType}
                        unlocked={isUnlocked}
                        progress={userAchievement?.progress || 0}
                        maxProgress={userAchievement?.max_progress || 100}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="guidelines">
            <Card className="p-6 shadow-card">
              <div className="space-y-6">
                <div className="text-center">
                  <div className="gradient-forest p-4 rounded-full w-16 h-16 mx-auto mb-4">
                    <Settings className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">How EcoPrompt Works</h3>
                  <p className="text-muted-foreground mb-6">
                    Learn about our calculations, recommendations, and how we help you reduce AI's environmental impact.
                  </p>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <Card className="p-4 bg-success/10 border-success/20">
                    <h4 className="font-medium text-success mb-2">🔍 Smart Suggestions</h4>
                    <p className="text-sm text-muted-foreground">
                      We detect when Google Search would be more eco-friendly than AI chat for factual questions.
                    </p>
                  </Card>
                  <Card className="p-4 bg-primary/10 border-primary/20">
                    <h4 className="font-medium text-primary mb-2">✂️ Prompt Optimization</h4>
                    <p className="text-sm text-muted-foreground">
                      Automatically trim unnecessary words to reduce token count and CO₂ emissions.
                    </p>
                  </Card>
                  <Card className="p-4 bg-warning/10 border-warning/20">
                    <h4 className="font-medium text-warning mb-2">📊 Accurate Calculations</h4>
                    <p className="text-sm text-muted-foreground">
                      Based on real-world data: ~0.5g CO₂ per 1000 tokens for large language models.
                    </p>
                  </Card>
                  <Card className="p-4 bg-accent/10 border-accent/20">
                    <h4 className="font-medium text-accent-foreground mb-2">🌱 Environmental Impact</h4>
                    <p className="text-sm text-muted-foreground">
                      Track trees, water, and energy saved through smarter AI usage patterns.
                    </p>
                  </Card>
                </div>

                <Button 
                  variant="eco" 
                  className="w-full"
                  onClick={() => navigate('/guidelines')}
                >
                  <Leaf className="h-4 w-4 mr-2" />
                  View Full Guidelines
                </Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="leaderboard">
            <Card className="p-6">
              <div className="text-center space-y-4">
                <div className="gradient-earth p-4 rounded-full w-16 h-16 mx-auto">
                  <BarChart3 className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">Global Leaderboard</h3>
                  <p className="text-muted-foreground">Coming soon! Compete with friends to save the most CO₂.</p>
                </div>
                <Button variant="eco" disabled>
                  <User className="h-4 w-4 mr-2" />
                  Invite Friends (Soon)
                </Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};