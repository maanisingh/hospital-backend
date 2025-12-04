#!/bin/bash
# Fix all middleware function calls in route files

echo "Fixing middleware calls in route files..."

# Fix requireAdmin()
find routes/ -name "*.js" -type f -exec sed -i 's/requireAdmin()/requireAdmin/g' {} \;

# Fix requireSuperAdmin()
find routes/ -name "*.js" -type f -exec sed -i 's/requireSuperAdmin()/requireSuperAdmin/g' {} \;

# Fix requirePermission() - but this one might need parameters, so be careful
# We'll skip this one for now since it should have parameters like requirePermission('PERM')

echo "Done! Fixed all middleware calls."
echo ""
echo "Files modified:"
git diff --name-only routes/
