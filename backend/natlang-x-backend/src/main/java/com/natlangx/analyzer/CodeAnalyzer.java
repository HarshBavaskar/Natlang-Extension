package com.natlangx.analyzer;

public abstract class CodeAnalyzer {
    public abstract AnalysisResult analyze(String code, String language);

    public AnalysisResult analyze(String code) {
        return analyze(code, "General");
    }
}
