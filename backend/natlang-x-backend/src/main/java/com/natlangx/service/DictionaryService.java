package com.natlangx.service;

import java.util.List;

import org.springframework.stereotype.Service;

import com.natlangx.dao.DictionaryDAO;
import com.natlangx.dto.DictionaryEntryRequest;
import com.natlangx.dto.DictionaryEntryResponse;

@Service
public class DictionaryService {
    private final DictionaryDAO dictionaryDAO;

    public DictionaryService(DictionaryDAO dictionaryDAO) {
        this.dictionaryDAO = dictionaryDAO;
    }

    public int ingest(List<DictionaryEntryRequest> entries) {
        return dictionaryDAO.upsert(entries);
    }

    public List<DictionaryEntryResponse> getAll() {
        return dictionaryDAO.findAll();
    }
}
