package com.natlangx.tools;

import com.natlangx.analyzer.AnalysisResult;
import com.natlangx.analyzer.ComplexityAnalyzer;

public class ComplexityAnalyzerTool implements Tool {
    private final ComplexityAnalyzer analyzer;
    private final String language;

    public ComplexityAnalyzerTool(ComplexityAnalyzer analyzer, String language) {
        this.analyzer = analyzer;
        this.language = language;
    }

    @Override
    public String execute(String input) {
        AnalysisResult result = analyzer.analyze(input, language);
        return result.getTimeComplexity() + "|" + result.getSpaceComplexity() + "|" + result.getSuggestions();
    }
}
