def test_register_login_me_flow(client):
    email = "flow@example.com"
    password = "hunter22"

    register = client.post("/auth/register", json={"email": email, "password": password})
    assert register.status_code == 201, register.text
    token = register.json()["access_token"]
    assert register.json()["user"]["email"] == email

    login = client.post("/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200
    assert login.json()["access_token"]

    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == email


def test_register_duplicate_email_rejected(client):
    body = {"email": "dupe@example.com", "password": "hunter22"}
    first = client.post("/auth/register", json=body)
    assert first.status_code == 201

    second = client.post("/auth/register", json=body)
    assert second.status_code == 400


def test_register_short_password_rejected(client):
    resp = client.post("/auth/register", json={"email": "short@example.com", "password": "abc"})
    assert resp.status_code == 400


def test_login_wrong_password_rejected(client):
    client.post("/auth/register", json={"email": "wrongpw@example.com", "password": "hunter22"})
    resp = client.post("/auth/login", json={"email": "wrongpw@example.com", "password": "nope"})
    assert resp.status_code == 401


def test_me_without_token_rejected(client):
    resp = client.get("/auth/me")
    assert resp.status_code == 401
