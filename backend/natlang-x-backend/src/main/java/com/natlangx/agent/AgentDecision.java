package com.natlangx.agent;

import java.util.ArrayList;
import java.util.List;

public class AgentDecision {
    private boolean shouldGenerate;
    private boolean shouldAnalyze;
    private boolean shouldOptimize;
    private boolean shouldExplain;
    private String decisionLog;
    private final List<String> steps = new ArrayList<>();

    public boolean isShouldGenerate() {
        return shouldGenerate;
    }

    public void setShouldGenerate(boolean shouldGenerate) {
        this.shouldGenerate = shouldGenerate;
    }

    public boolean isShouldAnalyze() {
        return shouldAnalyze;
    }

    public void setShouldAnalyze(boolean shouldAnalyze) {
        this.shouldAnalyze = shouldAnalyze;
    }

    public boolean isShouldOptimize() {
        return shouldOptimize;
    }

    public void setShouldOptimize(boolean shouldOptimize) {
        this.shouldOptimize = shouldOptimize;
    }

    public boolean isShouldExplain() {
        return shouldExplain;
    }

    public void setShouldExplain(boolean shouldExplain) {
        this.shouldExplain = shouldExplain;
    }

    public String getDecisionLog() {
        return decisionLog;
    }

    public void setDecisionLog(String decisionLog) {
        this.decisionLog = decisionLog;
    }

    public List<String> getSteps() {
        return steps;
    }
}
