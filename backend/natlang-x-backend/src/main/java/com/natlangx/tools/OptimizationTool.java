package com.natlangx.tools;

import com.natlangx.provider.AIProvider;

public class OptimizationTool implements Tool {
    private final AIProvider provider;
    private final String language;

    public OptimizationTool(AIProvider provider, String language) {
        this.provider = provider;
        this.language = language;
    }

    @Override
    public String execute(String input) {
        return provider.optimizeCode(input, language);
    }
}
