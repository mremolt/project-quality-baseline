// Deliberate violation: a framework import in application; dependency-cruiser must reject it (NEST-TEST-10).
import type { INestApplication } from '@nestjs/common';

export type DemoApp = INestApplication;
