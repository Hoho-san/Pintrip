def test_presign_upload(client, auth_headers):
    resp = client.post(
        "/photos/presign",
        headers=auth_headers,
        json={"filename": "trip.jpg", "content_type": "image/jpeg", "place_id": "place-1"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["upload_url"].startswith("https://")
    assert body["storage_path"].endswith(".jpg")


def test_presign_rejects_non_image_content_type(client, auth_headers):
    resp = client.post(
        "/photos/presign",
        headers=auth_headers,
        json={"filename": "trip.pdf", "content_type": "application/pdf", "place_id": "place-1"},
    )
    assert resp.status_code == 400


def test_list_photos_empty_for_new_place(client, auth_headers):
    resp = client.get("/photos/some-place-id", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_photos_require_auth(client):
    resp = client.get("/photos/some-place-id")
    assert resp.status_code == 401
