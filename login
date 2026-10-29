$ curl.exe --silent --show-error --fail-with-body --request POST --header "Content-Type: application/json" --data-binary @scripts/payloads/register.json --cookie-jar .evidence-cookies http://127.0.0.1:5000/customer/login --write-out "\nHTTP_STATUS:%{http_code}\n"

{
  "message": "Successfully logged in.",
  "username": "course_demo"
}
HTTP_STATUS:200
