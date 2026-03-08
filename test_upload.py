import requests

url = "http://localhost:8000/documents/upload/"
file_path = "proposalabhi.pdf"

try:
    with open(file_path, "rb") as f:
        files = {"file": (file_path, f, "application/pdf")}
        response = requests.post(url, files=files)
        print("Status Code:", response.status_code)
        print("Response:", response.json())
except Exception as e:
    print(f"Error: {e}")
