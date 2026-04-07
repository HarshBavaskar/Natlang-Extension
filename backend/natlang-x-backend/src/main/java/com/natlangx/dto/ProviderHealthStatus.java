package com.natlangx.dto;

public class ProviderHealthStatus {
    private String provider;
    private boolean configured;
    private boolean reachable;
    private String detail;

    public ProviderHealthStatus() {
    }

    public ProviderHealthStatus(String provider, boolean configured, boolean reachable, String detail) {
        this.provider = provider;
        this.configured = configured;
        this.reachable = reachable;
        this.detail = detail;
    }

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    public boolean isConfigured() {
        return configured;
    }

    public void setConfigured(boolean configured) {
        this.configured = configured;
    }

    public boolean isReachable() {
        return reachable;
    }

    public void setReachable(boolean reachable) {
        this.reachable = reachable;
    }

    public String getDetail() {
        return detail;
    }

    public void setDetail(String detail) {
        this.detail = detail;
    }
}
