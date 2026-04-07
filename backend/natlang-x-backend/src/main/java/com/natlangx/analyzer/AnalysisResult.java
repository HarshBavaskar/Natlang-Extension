package com.natlangx.analyzer;

public class AnalysisResult {
    private String timeComplexity;
    private String spaceComplexity;
    private String suggestions;

    public AnalysisResult() {
    }

    public AnalysisResult(String timeComplexity, String spaceComplexity, String suggestions) {
        this.timeComplexity = timeComplexity;
        this.spaceComplexity = spaceComplexity;
        this.suggestions = suggestions;
    }

    public String getTimeComplexity() {
        return timeComplexity;
    }

    public void setTimeComplexity(String timeComplexity) {
        this.timeComplexity = timeComplexity;
    }

    public String getSpaceComplexity() {
        return spaceComplexity;
    }

    public void setSpaceComplexity(String spaceComplexity) {
        this.spaceComplexity = spaceComplexity;
    }

    public String getSuggestions() {
        return suggestions;
    }

    public void setSuggestions(String suggestions) {
        this.suggestions = suggestions;
    }
}
