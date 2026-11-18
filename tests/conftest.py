import os

import pytest

import sp5gen
from sp5lib.database import SP5Database


@pytest.fixture
def db_dir(tmp_path):
    """A freshly generated synthetic database directory."""
    path = str(tmp_path / "data")
    sp5gen.generate(path)
    return path


@pytest.fixture
def db(db_dir):
    return SP5Database(db_dir)


@pytest.fixture(scope="session")
def sample_dir():
    """The sample database shipped with SP5, if SP5_SAMPLE_DB points to it."""
    path = os.environ.get("SP5_SAMPLE_DB")
    if not path:
        pytest.skip("SP5_SAMPLE_DB is not set")
    return path
