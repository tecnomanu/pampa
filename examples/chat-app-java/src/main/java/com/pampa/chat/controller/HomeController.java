package com.pampa.chat.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Home Controller
 * Serves the main chat page
 */
@Controller
public class HomeController {

    @GetMapping("/")
    public String index() {
        return "index"; // Returns static/index.html
    }
}
