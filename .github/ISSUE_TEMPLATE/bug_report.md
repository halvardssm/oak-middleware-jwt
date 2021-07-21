name: Bug Report description: File a bug report title: "[Bug]: " labels: [bug]
body:

- type: input attributes: label: Operating System description: What operating
  system are you using? placeholder: macOS Big Sur 11.4 validations: required:
  true
- type: input attributes: label: Deno version description: What version of Deno
  are you using? placeholder: 1.0.0 validations: required: true
- type: input attributes: label: Oak version description: What version of Oak
  are you using? placeholder: 8.0.0 validations: required: true
- type: textarea attributes: label: Bug description description: Describe the
  bug placeholder: A clear and concise description of what the bug is.
  validations: required: true
- type: textarea attributes: label: Steps to reproduce description: Add steps to
  reproduce the issue placeholder: | Steps to reproduce the behavior:

      1. Go to '...'
      2. Click on '....'
      3. Scroll down to '....'
      4. See error
  validations: required: true
- type: textarea attributes: label: Aditional information description: Add any
  aditional information you belive could help in fixing this issue validations:
  required: false
