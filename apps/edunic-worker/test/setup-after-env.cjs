// The shared pg pool is configured with allowExitOnIdle in Jest. Closing it from
// each spec file makes later integration suites fail because all files share the
// same transformed db module instance when run in-band.
