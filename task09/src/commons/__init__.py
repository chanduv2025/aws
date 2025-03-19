from commons.exception import ApplicationException

HTTP_STATUS_BAD_REQUEST = 400
HTTP_STATUS_UNAUTHORIZED = 401
HTTP_STATUS_FORBIDDEN = 403
HTTP_STATUS_NOT_FOUND = 404
HTTP_STATUS_SUCCESS = 200
HTTP_STATUS_SERVER_ERROR = 500
HTTP_STATUS_NOT_IMPLEMENTED = 501
HTTP_STATUS_SERVICE_UNAVAILABLE = 503


def create_response(data, status=HTTP_STATUS_SUCCESS):
    if status == HTTP_STATUS_SUCCESS:
        return {
            'status': status,
            'data': data
        }
    raise ApplicationException(
        code=status,
        content=data
    )


def trigger_error_response(status, message):
    raise ApplicationException(code=status, content=message)
