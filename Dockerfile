FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json requirements.txt ./
RUN npm ci && python3 -m venv /opt/window-edsl && /opt/window-edsl/bin/pip install --no-cache-dir -r requirements.txt
COPY . .
RUN npm run build
ENV HOST=0.0.0.0 PORT=8080 EDSL_PYTHON=/opt/window-edsl/bin/python
EXPOSE 8080
CMD ["npm","start"]
