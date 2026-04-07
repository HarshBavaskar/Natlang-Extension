package com.natlangx.tools;

import com.natlangx.provider.AIProvider;

public class CodeGeneratorTool implements Tool {
    private final AIProvider aiProvider;
    private final String language;

    public CodeGeneratorTool(AIProvider aiProvider, String language) {
        this.aiProvider = aiProvider;
        this.language = language;
    }

    @Override
    public String execute(String input) {
        return aiProvider.generateCode(input, language);
    }

    public String execute(String input, String fallbackLanguage) {
        return aiProvider.generateCode(input, fallbackLanguage);
    }
}
