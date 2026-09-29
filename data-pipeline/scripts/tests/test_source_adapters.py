import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SCRIPTS_DIR = PROJECT_ROOT / "data-pipeline" / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from source_adapters import (
    fetch_opencorporates,
    fetch_opensanctions,
    normalise_records,
    validate_source_credentials,
)


class TestSourceAdapters(unittest.TestCase):
    def test_validate_source_credentials_requires_all_required_values(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(ValueError):
                validate_source_credentials("opensanctions")

    def test_validate_source_credentials_accepts_values(self):
        with patch.dict(os.environ, {"OPENSANCTIONS_API_KEY": "abc123"}, clear=True):
            self.assertEqual(
                validate_source_credentials("opensanctions"),
                {"OPENSANCTIONS_API_KEY": "abc123"},
            )

    def test_normalise_records_handles_list_and_dict_payloads(self):
        self.assertEqual(
            normalise_records({"results": [{"name": "Acme"}, {"name": "Beta"}]}),
            [{"name": "Acme"}, {"name": "Beta"}],
        )

    @patch("source_adapters.request_json")
    def test_fetch_opensanctions_uses_api_key_and_params(self, mock_request_json):
        mock_request_json.return_value = {"results": [{"name": "Example entity"}]}

        with patch.dict(
            os.environ,
            {"OPENSANCTIONS_API_KEY": "token-123"},
            clear=True,
        ):
            results = fetch_opensanctions(query="acme", limit=10)

        self.assertEqual(results, [{"name": "Example entity"}])
        self.assertTrue(call := mock_request_json.call_args.kwargs)
        self.assertEqual(call["headers"]["Authorization"], "Token token-123")
        self.assertEqual(call["params"]["q"], "acme")

    @patch("source_adapters.request_json")
    def test_fetch_opencorporates_returns_normalised_records(self, mock_request_json):
        mock_request_json.return_value = {"results": [{"company": {"name": "Test Co"}}]}

        with patch.dict(
            os.environ,
            {"OPENCORPORATES_API_KEY": "key-456"},
            clear=True,
        ):
            results = fetch_opencorporates(q="test co", limit=5)

        self.assertEqual(results, [{"company": {"name": "Test Co"}}])
        self.assertEqual(mock_request_json.call_args.kwargs["params"]["q"], "test co")


if __name__ == "__main__":
    unittest.main()
