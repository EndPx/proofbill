"""Policy-review check of public source files; never runs during a purchase."""
import hashlib
import json
import re
from pathlib import Path

import requests
from ruamel.yaml import YAML

policy = json.loads((Path(__file__).resolve().parent.parent / "workers/inference/deployment-policy.json").read_text())
for service, sources in policy["model"]["runtime_services"].items():
    for source in sources:
        if (source["repository"] != "nearai/cvm-compose-files"
                or not re.fullmatch(r"[a-f0-9]{40}", source["commit"])
                or not re.fullmatch(r"prod/[A-Za-z0-9_./-]+", source["file"])
                or any(part in ("", ".", "..") for part in source["file"].split("/"))):
            raise ValueError("INVALID_SOURCE_PIN")
        url = f"https://raw.githubusercontent.com/nearai/cvm-compose-files/{source['commit']}/{source['file']}"
        response = requests.get(url, timeout=30, allow_redirects=False)
        if response.status_code != 200 or len(response.content) > 2_000_000:
            raise ValueError("SOURCE_PIN_UNAVAILABLE")
        if hashlib.sha256(response.content).hexdigest() != source["file_sha256"]:
            raise ValueError("SOURCE_FILE_DIGEST_MISMATCH")
        image = YAML(typ="safe", pure=True).load(response.text)["services"][service]["image"]
        if image != source["image"] or not re.fullmatch(r"[A-Za-z0-9_./:-]+@sha256:[a-f0-9]{64}", image):
            raise ValueError("SOURCE_IMAGE_PIN_MISMATCH")
    print(f"{service}: source revision, file bytes and immutable image pin verified; build provenance not asserted")
