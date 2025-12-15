FROM nginx:alpine

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy static files (assets are now inside src/)
COPY src/ /usr/share/nginx/html/

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]