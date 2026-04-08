package com.natlangx.dto;

import jakarta.validation.constraints.NotBlank;

public class DictionaryEntryRequest {
    @NotBlank(message = "Term is required")
    private String term;

    @NotBlank(message = "Canonical value is required")
    private String canonical;

    private Double confidence;
    private String source;

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

    public Double getConfidence() {
        return confidence;
    }

    public void setConfidence(Double confidence) {
        this.confidence = confidence;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }
}
