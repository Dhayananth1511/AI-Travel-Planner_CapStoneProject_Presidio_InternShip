# ============================================================
# infrastructure/variables.tf
#
# Declares all input variables for main.tf.
# NEVER put real values here — use terraform.tfvars for that.
# Sensitive variables are marked sensitive = true so Terraform
# won't print them in plan/apply output.
# ============================================================

variable "aws_region" {
  description = "AWS region to deploy all resources into"
  type        = string
  default     = "ap-south-1"   # Mumbai — closest to India, good latency
}

variable "project_name" {
  description = "Project prefix used for naming all AWS resources"
  type        = string
  default     = "travel-planner"
}

variable "key_pair_name" {
  description = "Name of the EC2 Key Pair created in AWS Console (just the name, not the .pem file path)"
  type        = string
  # Example: "travel-planner-key"
}

variable "dockerhub_username" {
  description = "Your Docker Hub username — used in docker-compose.prod.yml on EC2"
  type        = string
  # Example: "prasadnair"
}

# ── Sensitive variables (marked sensitive — never printed in logs) ──

variable "mongo_uri" {
  description = "MongoDB Atlas connection string (mongodb+srv://...)"
  type        = string
  sensitive   = true
}

variable "groq_api_key" {
  description = "Groq LLM API key (gsk_...)"
  type        = string
  sensitive   = true
}

variable "jwt_access_secret" {
  description = "JWT access token secret — use a long random string (32+ chars)"
  type        = string
  sensitive   = true
}

variable "jwt_refresh_secret" {
  description = "JWT refresh token secret — use a different long random string"
  type        = string
  sensitive   = true
}

variable "google_maps_key" {
  description = "Google Maps / Places API key (AIza...)"
  type        = string
  sensitive   = true
}

# ── Additional Server Env Variables ──

variable "port" {
  description = "Port the server listens on"
  type        = number
  default     = 5000
}

variable "jwt_access_expires" {
  description = "JWT access token expiry time"
  type        = string
  default     = "15m"
}

variable "jwt_refresh_expires" {
  description = "JWT refresh token expiry time"
  type        = string
  default     = "7d"
}

variable "hotelbeds_api_key" {
  description = "Hotelbeds API Key"
  type        = string
  sensitive   = true
}

variable "hotelbeds_api_secret" {
  description = "Hotelbeds API Secret"
  type        = string
  sensitive   = true
}

variable "hotelbeds_base_url" {
  description = "Hotelbeds API Base URL"
  type        = string
  default     = "https://api.test.hotelbeds.com"
}

variable "activity_api_key" {
  description = "Activity API Key"
  type        = string
  sensitive   = true
}

variable "transfers_api_key" {
  description = "Transfers API Key"
  type        = string
  sensitive   = true
}

variable "google_calendar_client_id" {
  description = "Google Calendar Client ID"
  type        = string
  sensitive   = true
}

variable "google_calendar_client_secret" {
  description = "Google Calendar Client Secret"
  type        = string
  sensitive   = true
}

variable "google_calendar_redirect_uri" {
  description = "Google Calendar Redirect URI"
  type        = string
  default     = "http://localhost:5000/api/auth/google/callback"
}

variable "aviationstack_api_key" {
  description = "AviationStack API Key"
  type        = string
  sensitive   = true
}

variable "openweather_api_key" {
  description = "OpenWeather API Key"
  type        = string
  sensitive   = true
}

