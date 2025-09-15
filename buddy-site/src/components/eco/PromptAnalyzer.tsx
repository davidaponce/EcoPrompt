import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/eco-button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Leaf, Search, Sparkles, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PromptAnalyzerProps {
  onCO2Save?: (amount: number) => void;
}

export const PromptAnalyzer = ({ onCO2Save }: PromptAnalyzerProps) => {
  const [prompt, setPrompt] = useState("");
  const [analysis, setAnalysis] = useState<{
    tokens: number;
    co2Estimate: number;
    suggestion: string;
    optimizedPrompt?: string;
    canUseSearch: boolean;
  } | null>(null);
  const { toast } = useToast();

  const analyzePrompt = () => {
    if (!prompt.trim()) return;

    // More accurate token estimation (GPT-4 style: ~3.3 chars per token average)
    const estimatedTokens = Math.ceil(prompt.length / 3.3);
    
    // Updated CO2 estimate: ~0.5g CO2 per 1000 tokens for large language models (ChatGPT-4 level)
    const co2Estimate = (estimatedTokens / 1000) * 0.5;
    
    // Check if it's a simple factual question
    const factualKeywords = ['what is', 'who is', 'when did', 'where is', 'how many', 'define'];
    const canUseSearch = factualKeywords.some(keyword => 
      prompt.toLowerCase().includes(keyword)
    );

    // Generate suggestions
    let suggestion = "";
    let optimizedPrompt = "";

    if (canUseSearch) {
      suggestion = "This looks like a factual question! A Google search would be 20x more eco-friendly.";
    } else if (estimatedTokens > 150) {
      suggestion = "Your prompt is quite long. Consider making it more concise to reduce CO₂ emissions.";
      // Simple optimization: remove filler words
      optimizedPrompt = prompt
        .replace(/please|could you|kindly|would you mind|if possible/gi, "")
        .replace(/\s+/g, " ")
        .trim();
    } else if (estimatedTokens < 50) {
      suggestion = "Great! Your prompt is already concise and eco-friendly.";
    } else {
      suggestion = "Your prompt length looks good for an AI query.";
    }

    setAnalysis({
      tokens: estimatedTokens,
      co2Estimate,
      suggestion,
      optimizedPrompt: optimizedPrompt !== prompt ? optimizedPrompt : undefined,
      canUseSearch,
    });
  };

  const handleOptimize = () => {
    if (analysis?.optimizedPrompt) {
      const savedTokens = analysis.tokens - Math.ceil(analysis.optimizedPrompt.length / 3.3);
      const co2Saved = (savedTokens / 1000) * 0.5;
      
      setPrompt(analysis.optimizedPrompt);
      onCO2Save?.(co2Saved);
      
      toast({
        title: "Prompt Optimized! 🌱",
        description: `Saved ${savedTokens} tokens and ${co2Saved.toFixed(2)}g CO₂`,
      });
      
      setAnalysis(null);
    }
  };

  const handleUseSearch = () => {
    const co2Saved = analysis?.co2Estimate || 0;
    onCO2Save?.(co2Saved);
    
    toast({
      title: "Great Choice! 🌍",
      description: `Using search instead saved ${co2Saved.toFixed(2)}g CO₂`,
    });
    
    // Open Google search with the prompt
    window.open(`https://google.com/search?q=${encodeURIComponent(prompt)}`, '_blank');
    setPrompt("");
    setAnalysis(null);
  };

  return (
    <Card className="p-6 shadow-card">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Eco Prompt Analyzer</h3>
        </div>
        
        <Textarea
          placeholder="Type your AI prompt here to analyze its environmental impact..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="min-h-[100px]"
        />
        
        <Button 
          onClick={analyzePrompt}
          disabled={!prompt.trim()}
          variant="eco"
          className="w-full"
        >
          <Leaf className="h-4 w-4" />
          Analyze Environmental Impact
        </Button>

        {analysis && (
          <div className="space-y-4 p-4 rounded-lg bg-muted/50">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 rounded-lg bg-primary/10">
                <div className="text-2xl font-bold text-primary">{analysis.tokens}</div>
                <div className="text-sm text-muted-foreground">Tokens</div>
                <div className="text-xs text-muted-foreground mt-1">~{Math.ceil(analysis.tokens / 1000)} KB processing</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-warning/10">
                <div className="text-2xl font-bold text-warning">{analysis.co2Estimate.toFixed(3)}g</div>
                <div className="text-sm text-muted-foreground">CO₂ Footprint</div>
                <div className="text-xs text-muted-foreground mt-1">≈ {(analysis.co2Estimate / 0.04).toFixed(1)} Google searches</div>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 rounded-md bg-card">
              <AlertCircle className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
              <p className="text-sm">{analysis.suggestion}</p>
            </div>

            <div className="flex gap-2">
              {analysis.canUseSearch && (
                <Button onClick={handleUseSearch} variant="hero" className="flex-1">
                  <Search className="h-4 w-4" />
                  Use Google Instead
                </Button>
              )}
              
              {analysis.optimizedPrompt && (
                <Button onClick={handleOptimize} variant="achievement" className="flex-1">
                  <Zap className="h-4 w-4" />
                  Optimize Prompt
                </Button>
              )}
            </div>

            {analysis.optimizedPrompt && (
              <div className="p-3 rounded-md bg-success/10 border border-success/20">
                <Badge variant="secondary" className="mb-2">Optimized Version</Badge>
                <p className="text-sm">{analysis.optimizedPrompt}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};