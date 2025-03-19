class AppError(Exception):
    def __init__(self, status_code, message):
        self.status_code = status_code
        self.message = message
        super().__init__(f"{status_code}: {message}")

    def __str__(self):
        return f"Error {self.status_code}: {self.message}"
