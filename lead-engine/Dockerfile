FROM python:3.13-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY lead_engine ./lead_engine
USER 1000
ENTRYPOINT ["python", "-m", "lead_engine"]
CMD ["run", "--trigger", "scheduler"]
