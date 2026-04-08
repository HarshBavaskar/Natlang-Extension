package com.natlangx.dto;

import java.util.ArrayList;
import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

public class DictionaryIngestRequest {
    @Valid
    @NotEmpty(message = "Entries are required")
    private List<DictionaryEntryRequest> entries = new ArrayList<>();

    public List<DictionaryEntryRequest> getEntries() {
        return entries;
    }

    public void setEntries(List<DictionaryEntryRequest> entries) {
        this.entries = entries;
    }
}
