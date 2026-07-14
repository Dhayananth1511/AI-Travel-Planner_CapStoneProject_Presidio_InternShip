# ============================================================
# infrastructure/outputs.tf
#
# After "terraform apply" completes, Terraform prints these values.
# Copy them — you need them for:
#   - GitHub Secrets (EC2_HOST, S3_BUCKET_NAME, CLOUDFRONT_*)
#   - Your VITE_API_URL in GitHub Actions CD pipeline
# ============================================================

output "ec2_instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.api.id
}

output "ec2_elastic_ip" {
  description = "Fixed public IP of EC2 — use this as EC2_HOST in GitHub Secrets"
  value       = aws_eip.api_eip.public_ip
}

output "api_url" {
  description = "Full URL to access the backend API"
  value       = "http://${aws_eip.api_eip.public_ip}:5000"
}

output "s3_bucket_name" {
  description = "S3 bucket name — use this as S3_BUCKET_NAME in GitHub Secrets"
  value       = aws_s3_bucket.frontend.bucket
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID — use as CLOUDFRONT_DISTRIBUTION_ID in GitHub Secrets"
  value       = aws_cloudfront_distribution.frontend.id
}

output "cloudfront_domain" {
  description = "CloudFront URL — use as CLOUDFRONT_DOMAIN in GitHub Secrets, and visit this URL to see your app"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "frontend_url" {
  description = "Full URL to access the React frontend (HTTPS via CloudFront)"
  value       = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

output "ssm_parameter_names" {
  description = "SSM Parameter Store paths where secrets are stored"
  value = {
    mongo_uri          = aws_ssm_parameter.mongo_uri.name
    groq_api_key       = aws_ssm_parameter.groq_api_key.name
    jwt_access_secret  = aws_ssm_parameter.jwt_access_secret.name
    jwt_refresh_secret = aws_ssm_parameter.jwt_refresh_secret.name
    google_maps_key    = aws_ssm_parameter.google_maps_api_key.name
  }
}

output "cloudwatch_log_group" {
  description = "CloudWatch log group — view API logs here in AWS Console"
  value       = aws_cloudwatch_log_group.api_logs.name
}

output "next_steps" {
  description = "What to do after terraform apply"
  value = <<-EOT

  ✅ Terraform apply complete! Here's what to do next:

  1. Add these to GitHub Secrets (repo Settings → Secrets → Actions):
       EC2_HOST                  = ${aws_eip.api_eip.public_ip}
       S3_BUCKET_NAME            = ${aws_s3_bucket.frontend.bucket}
       CLOUDFRONT_DISTRIBUTION_ID = ${aws_cloudfront_distribution.frontend.id}
       CLOUDFRONT_DOMAIN          = ${aws_cloudfront_distribution.frontend.domain_name}

  2. Push your code to GitHub main branch to trigger the CD pipeline.

  3. Wait ~5 mins → Then visit:
       ${aws_cloudfront_distribution.frontend.domain_name}

  EOT
}
