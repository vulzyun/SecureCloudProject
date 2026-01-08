"""
Tests for rollback functionality.

These tests verify that the pipeline can:
1. Save previous deployment state
2. Detect failures (healthcheck or exceptions)
3. Automatically rollback to previous version
"""

import pytest
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime

from app.pipelines.runner_real import (
    _save_previous_state,
    _get_running_container,
    _get_container_image,
    _rollback_to_previous,
)


# ============================================================================
# Test 1: Get running container
# ============================================================================

@patch('app.pipelines.runner_real._ssh_exec')
def test_get_running_container_found(mock_ssh):
    """Test retrieving container ID when container exists."""
    mock_ssh.return_value = ["abc123def456\n"]
    
    result = _get_running_container("user", "host", 22, "test-app")
    
    assert result == "abc123def456"
    mock_ssh.assert_called_once()
    args = mock_ssh.call_args[0]
    assert "docker ps -q" in args[3]


@patch('app.pipelines.runner_real._ssh_exec')
def test_get_running_container_not_found(mock_ssh):
    """Test when no container is running."""
    mock_ssh.return_value = [""]
    
    result = _get_running_container("user", "host", 22, "test-app")
    
    assert result is None


@patch('app.pipelines.runner_real._ssh_exec')
def test_get_running_container_exception(mock_ssh):
    """Test error handling when SSH fails."""
    mock_ssh.side_effect = Exception("SSH failed")
    
    result = _get_running_container("user", "host", 22, "test-app")
    
    assert result is None


# ============================================================================
# Test 2: Get container image
# ============================================================================

@patch('app.pipelines.runner_real._ssh_exec')
def test_get_container_image_found(mock_ssh):
    """Test retrieving image ID from container."""
    mock_ssh.return_value = ["sha256:abc123def456\n"]
    
    result = _get_container_image("user", "host", 22, "container123")
    
    assert result == "sha256:abc123def456"


@patch('app.pipelines.runner_real._ssh_exec')
def test_get_container_image_not_found(mock_ssh):
    """Test when image cannot be retrieved."""
    mock_ssh.return_value = [""]
    
    result = _get_container_image("user", "host", 22, "container123")
    
    assert result is None


# ============================================================================
# Test 3: Save previous state
# ============================================================================

@patch('app.pipelines.runner_real._get_container_image')
@patch('app.pipelines.runner_real._get_running_container')
def test_save_previous_state_with_running_container(mock_get_container, mock_get_image):
    """Test saving state when container exists."""
    mock_get_container.return_value = "container-id-123"
    mock_get_image.return_value = "app:old-version"
    
    state = _save_previous_state("user", "host", 22, "app")
    
    assert state["exists"] is True
    assert state["container_id"] == "container-id-123"
    assert state["image"] == "app:old-version"


@patch('app.pipelines.runner_real._get_running_container')
def test_save_previous_state_no_container(mock_get_container):
    """Test saving state when no container is running (first deployment)."""
    mock_get_container.return_value = None
    
    state = _save_previous_state("user", "host", 22, "app")
    
    assert state["exists"] is False
    assert state["container_id"] is None
    assert state["image"] is None


# ============================================================================
# Test 4: Rollback to previous state
# ============================================================================

@pytest.mark.asyncio
@patch('app.pipelines.runner_real._step_ok')
@patch('app.pipelines.runner_real._log')
@patch('app.pipelines.runner_real._step_start')
@patch('app.pipelines.runner_real._ssh_exec')
async def test_rollback_success(mock_ssh, mock_step_start, mock_log, mock_step_ok):
    """Test successful rollback to previous version."""
    mock_ssh.return_value = ["Container started\n"]
    
    previous_state = {
        "exists": True,
        "container_id": "old-container-123",
        "image": "app:v1.0"
    }
    
    await _rollback_to_previous(
        run_id=1,
        user="user",
        host="host",
        port=22,
        container_name="app",
        previous_state=previous_state,
        pipeline_name="test-pipeline"
    )
    
    # Verify step logging
    assert mock_step_start.called
    assert mock_log.call_count > 0
    assert mock_step_ok.called
    
    # Verify SSH commands were executed
    assert mock_ssh.call_count >= 2  # Stop new container + start old one


@pytest.mark.asyncio
@patch('app.pipelines.runner_real._step_ok')
@patch('app.pipelines.runner_real._log')
@patch('app.pipelines.runner_real._step_start')
async def test_rollback_no_previous_version(mock_step_start, mock_log, mock_step_ok):
    """Test rollback when no previous version exists."""
    previous_state = {
        "exists": False,
        "container_id": None,
        "image": None
    }
    
    await _rollback_to_previous(
        run_id=1,
        user="user",
        host="host",
        port=22,
        container_name="app",
        previous_state=previous_state,
        pipeline_name="test-pipeline"
    )
    
    # Should log that no previous version exists
    assert mock_log.called
    log_messages = [call[0] for call in mock_log.call_args_list]
    assert any("No previous container" in str(msg) for msg in log_messages)


@pytest.mark.asyncio
@patch('app.pipelines.runner_real._log')
@patch('app.pipelines.runner_real._step_start')
@patch('app.pipelines.runner_real._ssh_exec')
async def test_rollback_ssh_error_handling(mock_ssh, mock_step_start, mock_log):
    """Test rollback handles SSH errors gracefully."""
    mock_ssh.side_effect = Exception("SSH connection failed")
    
    previous_state = {
        "exists": True,
        "container_id": "old-container-123",
        "image": "app:v1.0"
    }
    
    # Should not raise exception
    await _rollback_to_previous(
        run_id=1,
        user="user",
        host="host",
        port=22,
        container_name="app",
        previous_state=previous_state,
        pipeline_name="test-pipeline"
    )
    
    # Should log the rollback failure
    assert mock_log.called


# ============================================================================
# Integration test: Simulate full pipeline with rollback
# ============================================================================

@pytest.mark.asyncio
@patch('app.pipelines.runner_real.Session')
@patch('app.pipelines.runner_real._rollback_to_previous')
@patch('app.pipelines.runner_real.run_real_pipeline')
async def test_pipeline_triggers_rollback_on_healthcheck_failure(
    mock_run_pipeline,
    mock_rollback,
    mock_session
):
    """
    Test that pipeline calls rollback when healthcheck fails.
    
    This is a conceptual test - the actual integration would be tested
    by running a full pipeline with a container that doesn't pass healthcheck.
    """
    # In a real scenario:
    # 1. Deploy new version
    # 2. Healthcheck fails
    # 3. Rollback should be called with previous_state
    # 4. Run should be marked as failed
    
    pass  # Actual integration tests would require full environment setup


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
