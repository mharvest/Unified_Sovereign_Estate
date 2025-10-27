# ┌───────────────────────────────┐
# │ Harvest Estate Sovereign Make │
# └───────────────────────────────┘

DEMO_ENV=.env.demo
LIVE_ENV=.env.live

.PHONY: build demo live stop restart logs test seed-demo nav-ticker ledger-export redeem-demo clean attest-json

cycle-watcher:
	cd se7en-backend && npx tsx scripts/run_cycle_watcher.ts

build:
	docker-compose build

demo: build
	@echo "🚀 Launching DEMO Mode..."
	docker-compose --env-file $(DEMO_ENV) up -d

live: build
	@echo "🛡️ Launching LIVE Mode..."
	docker-compose --env-file $(LIVE_ENV) up -d

stop:
	docker-compose down

restart:
	docker-compose down && docker-compose up -d

logs:
	docker-compose logs -f

test:
	docker compose exec se7en npm test

seed-demo:
	docker compose exec se7en npx prisma db push --skip-generate
	docker compose exec se7en npx tsx /app/scripts/seed_demo_data.ts

nav-ticker:
	curl -N http://localhost:4000/api/nav/preview

ledger-export:
	curl -o ledger.csv http://localhost:4000/api/ledger/export

attest-json:
	cd se7en-backend && npm run attest:json -- $(FILES)

redeem-demo:
	curl -X POST http://localhost:4000/treasury/redeem \
		-H "Content-Type: application/json" \
		-d '{"holderId":"RUDY-CELAYA-001","tokens":1500}'

clean:
	docker system prune -a -f
