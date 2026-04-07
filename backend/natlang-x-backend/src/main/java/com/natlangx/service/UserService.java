package com.natlangx.service;

import com.natlangx.dao.UserDAO;
import com.natlangx.dto.LoginRequest;
import com.natlangx.dto.UserRequest;
import com.natlangx.exception.ApiException;
import com.natlangx.model.User;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class UserService {
    private final UserDAO userDAO;

    public UserService(UserDAO userDAO) {
        this.userDAO = userDAO;
    }

    public User create(UserRequest request) {
        validateRole(request.getRole());
        userDAO.findByEmail(request.getEmail()).ifPresent(existing -> {
            throw new ApiException("Email already exists");
        });

        User user = new User();
        user.setName(request.getName());
        user.setEmail(request.getEmail());
        user.setPassword(request.getPassword());
        user.setRole(request.getRole().toUpperCase());
        return userDAO.create(user);
    }

    public List<User> getAll() {
        return userDAO.findAll();
    }

    public User getById(int id) {
        return userDAO.findById(id).orElseThrow(() -> new ApiException("User not found"));
    }

    public User update(int id, UserRequest request) {
        validateRole(request.getRole());
        User existing = getById(id);
        existing.setName(request.getName());
        existing.setEmail(request.getEmail());
        existing.setPassword(request.getPassword());
        existing.setRole(request.getRole().toUpperCase());

        boolean updated = userDAO.update(id, existing);
        if (!updated) {
            throw new ApiException("User update failed");
        }
        return getById(id);
    }

    public void delete(int id) {
        boolean deleted = userDAO.delete(id);
        if (!deleted) {
            throw new ApiException("User delete failed");
        }
    }

    public User login(LoginRequest request) {
        return login(request.getEmail(), request.getPassword());
    }

    // Method overloading demonstration.
    public User login(String email, String password) {
        User user = userDAO.findByEmail(email).orElseThrow(() -> new ApiException("Invalid credentials"));
        if (!user.getPassword().equals(password)) {
            throw new ApiException("Invalid credentials");
        }
        return user;
    }

    private void validateRole(String role) {
        if (role == null) {
            throw new ApiException("Role is required");
        }
        String normalized = role.toUpperCase();
        if (!"ADMIN".equals(normalized) && !"USER".equals(normalized)) {
            throw new ApiException("Role must be ADMIN or USER");
        }
    }
}
