FROM alpine:3.22@sha256:2e0b81d60597f449baa56dc25d355367869d2dca4cd57e866f1e2b52af3eb55f
RUN apk add --no-cache strace python3 build-base cmake git
COPY normalize.py /opt/normalize.py
COPY entry.py /opt/entry.py
ENTRYPOINT ["python3", "/opt/entry.py"]
