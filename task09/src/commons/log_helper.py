import logging
import os
from sys import stdout

# Mapping of log level names to logging constants
LOG_LEVELS = {
    'CRITICAL': logging.CRITICAL,
    'FATAL': logging.FATAL,
    'ERROR': logging.ERROR,
    'WARNING': logging.WARNING,
    'INFO': logging.INFO,
    'DEBUG': logging.DEBUG
}

# Base logger configuration
base_logger = logging.getLogger(__name__)
base_logger.propagate = False

# Configure console handler
console_handler = logging.StreamHandler(stream=stdout)
console_handler.setFormatter(logging.Formatter(
    '%(asctime)s - %(levelname)s - %(name)s - %(message)s'
))
base_logger.addHandler(console_handler)

# Set default log level from environment or fallback to INFO
default_log_level = LOG_LEVELS.get(os.getenv('LOG_LEVEL', 'INFO').upper(), logging.INFO)
base_logger.setLevel(default_log_level)
logging.captureWarnings(True)


def get_logger(name, level=default_log_level):
    """
    Returns a logger with the specified name and log level.
    
    :param name: Name of the logger.
    :param level: Logging level (default: from environment or INFO).
    :return: Configured logger instance.
    """
    child_logger = base_logger.getChild(name)
    if level:
        child_logger.setLevel(level)
    return child_logger
