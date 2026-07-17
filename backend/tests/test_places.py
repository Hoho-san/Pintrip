def test_places_crud_flow(client, auth_headers):
    create = client.post(
        "/places/",
        headers=auth_headers,
        json={"name": "Kyoto", "country": "Japan", "lat": 35.0, "lng": 135.7},
    )
    assert create.status_code == 201, create.text
    place = create.json()
    assert place["name"] == "Kyoto"
    place_id = place["id"]

    listed = client.get("/places/", headers=auth_headers)
    assert listed.status_code == 200
    assert any(p["id"] == place_id for p in listed.json())

    fetched = client.get(f"/places/{place_id}", headers=auth_headers)
    assert fetched.status_code == 200
    assert fetched.json()["id"] == place_id

    updated = client.put(
        f"/places/{place_id}",
        headers=auth_headers,
        json={"name": "Kyoto (updated)", "lat": 35.0, "lng": 135.7},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Kyoto (updated)"

    deleted = client.delete(f"/places/{place_id}", headers=auth_headers)
    assert deleted.status_code == 204

    missing = client.get(f"/places/{place_id}", headers=auth_headers)
    assert missing.status_code == 404


def test_places_require_auth(client):
    resp = client.get("/places/")
    assert resp.status_code == 401


def test_get_other_users_place_not_found(client, auth_headers):
    create = client.post(
        "/places/",
        headers=auth_headers,
        json={"name": "Private Spot", "lat": 1.0, "lng": 1.0},
    )
    place_id = create.json()["id"]

    other_email = f"other-{place_id}@example.com"
    other_register = client.post(
        "/auth/register", json={"email": other_email, "password": "hunter22"}
    )
    other_headers = {"Authorization": f"Bearer {other_register.json()['access_token']}"}

    resp = client.get(f"/places/{place_id}", headers=other_headers)
    assert resp.status_code == 404
