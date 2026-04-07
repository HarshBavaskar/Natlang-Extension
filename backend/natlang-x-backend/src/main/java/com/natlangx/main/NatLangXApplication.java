package com.natlangx.main;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "com.natlangx")
public class NatLangXApplication {
    public static void main(String[] args) {
        SpringApplication.run(NatLangXApplication.class, args);
    }
}
