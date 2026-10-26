# Historical image recipe. Production runs use the existing jitk-oracle:08 ID,
# mounting build/oracle-profile and overriding its entrypoint; never retag it.
FROM alpine:3.22@sha256:2e0b81d60597f449baa56dc25d355367869d2dca4cd57e866f1e2b52af3eb55f
RUN apk add --no-cache strace
ENTRYPOINT ["/oracle-profile"]
