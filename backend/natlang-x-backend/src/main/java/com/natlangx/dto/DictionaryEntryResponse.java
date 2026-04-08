package com.natlangx.dto;

public class DictionaryEntryResponse {
    private String term;
    private String canonical;
    private double confidence;
    private String source;

    public DictionaryEntryResponse() {
    }

    public DictionaryEntryResponse(String term, String canonical, double confidence, String source) {
        this.term = term;
        this.canonical = canonical;
        this.confidence = confidence;
        this.source = source;
    }

    public String getTerm() {
        return term;
    }

    public void setTerm(String term) {
        this.term = term;
    }

    public String getCanonical() {
        return canonical;
    }

    public void setCanonical(String canonical) {
        this.canonical = canonical;
    }

    public double getConfidence() {
        return confidence;
    }

    public void setConfidence(double confidence) {
        this.confidence = confidence;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }
}
