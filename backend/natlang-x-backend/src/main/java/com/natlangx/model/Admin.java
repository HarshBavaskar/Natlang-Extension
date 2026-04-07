package com.natlangx.model;

public class Admin extends User {
    private boolean superAdmin;

    public Admin() {
        setRole("ADMIN");
    }

    public Admin(Integer id, String name, String email, String password, boolean superAdmin) {
        super(id, name, email, password, "ADMIN");
        this.superAdmin = superAdmin;
    }

    public boolean isSuperAdmin() {
        return superAdmin;
    }

    public void setSuperAdmin(boolean superAdmin) {
        this.superAdmin = superAdmin;
    }

    @Override
    public String roleLabel() {
        return superAdmin ? "SUPER_ADMIN" : "ADMIN";
    }
}
