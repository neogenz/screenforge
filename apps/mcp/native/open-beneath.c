#define _POSIX_C_SOURCE 200809L
#ifdef __APPLE__
#define _DARWIN_C_SOURCE
#endif

#include <errno.h>
#include <fcntl.h>
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <time.h>
#include <unistd.h>

#ifdef __APPLE__
#include <sys/param.h>
#endif

#ifndef O_CLOEXEC
#define O_CLOEXEC 0
#endif

#define MAX_ASSET_BYTES (16 * 1024 * 1024)

static int fail(const char *message) {
  fprintf(stderr, "%s\n", message);
  return 1;
}

static int descriptor_path(int fd, char *target, size_t size) {
#ifdef __APPLE__
  (void)size;
  return fcntl(fd, F_GETPATH, target);
#elif defined(__linux__)
  char link[64];
  snprintf(link, sizeof(link), "/proc/%ld/fd/%d", (long)getpid(), fd);
  ssize_t length = readlink(link, target, size - 1);
  if (length < 0) return -1;
  target[length] = '\0';
  return 0;
#else
  (void)fd;
  (void)target;
  (void)size;
  errno = ENOTSUP;
  return -1;
#endif
}

#ifdef SCREENFORGE_TEST_HOOKS
static int checkpoint(const char *directory, const char *phase, size_t index) {
  if (directory == NULL) return 0;
  char marker[PATH_MAX];
  char resume[PATH_MAX];
  if (snprintf(marker, sizeof(marker), "%s/%s-%zu", directory, phase, index) >=
          (int)sizeof(marker) ||
      snprintf(resume, sizeof(resume), "%s/continue-%s-%zu", directory, phase, index) >=
          (int)sizeof(resume))
    return -1;
  int marker_fd = open(marker, O_WRONLY | O_CREAT | O_EXCL | O_CLOEXEC, 0600);
  if (marker_fd < 0) return -1;
  close(marker_fd);
  struct timespec pause = {.tv_sec = 0, .tv_nsec = 1000000};
  while (access(resume, F_OK) != 0) nanosleep(&pause, NULL);
  return unlink(resume);
}
#else
static int checkpoint(const char *directory, const char *phase, size_t index) {
  (void)directory;
  (void)phase;
  (void)index;
  return 0;
}
#endif

int main(int argc, char **argv) {
#ifdef SCREENFORGE_TEST_HOOKS
  if (argc != 3 && argc != 4) return fail("usage: open-beneath ROOT RELATIVE [HOOK_DIR]");
  const char *hook_directory = argc == 4 ? argv[3] : NULL;
#else
  if (argc != 3) return fail("usage: open-beneath ROOT RELATIVE");
  const char *hook_directory = NULL;
#endif
  const char *root = argv[1];
  const char *relative = argv[2];
  if (relative[0] == '\0' || relative[0] == '/') return fail("invalid relative path");

  int current = open(root, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (current < 0) return fail("authorized root unavailable");
  char opened_root[PATH_MAX];
  if (descriptor_path(current, opened_root, sizeof(opened_root)) != 0 ||
      strcmp(opened_root, root) != 0) {
    close(current);
    return fail("authorized root replaced");
  }

  char *path = strdup(relative);
  if (path == NULL) {
    close(current);
    return fail("out of memory");
  }
  char *cursor = path;
  size_t index = 0;
  for (;;) {
    char *component = cursor;
    char *separator = strchr(cursor, '/');
    if (separator == NULL)
      cursor = NULL;
    else {
      *separator = '\0';
      cursor = separator + 1;
    }
    if (component[0] == '\0' || strcmp(component, ".") == 0 || strcmp(component, "..") == 0) {
      free(path);
      close(current);
      return fail("invalid path component");
    }
    const int final = cursor == NULL;
    if (checkpoint(hook_directory, "before", index) != 0) {
      free(path);
      close(current);
      return fail("test checkpoint failed");
    }
    int next = openat(current, component,
                      O_RDONLY | O_NOFOLLOW | O_CLOEXEC | (final ? 0 : O_DIRECTORY));
    if (next < 0) {
      free(path);
      close(current);
      return fail("path escaped or was replaced");
    }
    close(current);
    current = next;
    if (checkpoint(hook_directory, "after", index) != 0) {
      free(path);
      close(current);
      return fail("test checkpoint failed");
    }
    index += 1;
    if (final) break;
  }
  free(path);

  struct stat info;
  if (fstat(current, &info) != 0 || !S_ISREG(info.st_mode)) {
    close(current);
    return fail("not a regular file");
  }
  unsigned char buffer[64 * 1024];
  size_t total = 0;
  for (;;) {
    ssize_t count = read(current, buffer, sizeof(buffer));
    if (count < 0) {
      close(current);
      return fail("read failed");
    }
    if (count == 0) break;
    total += (size_t)count;
    if (total > MAX_ASSET_BYTES) {
      close(current);
      return fail("file too large");
    }
    size_t written = 0;
    while (written < (size_t)count) {
      ssize_t amount = write(STDOUT_FILENO, buffer + written, (size_t)count - written);
      if (amount <= 0) {
        close(current);
        return fail("write failed");
      }
      written += (size_t)amount;
    }
  }
  close(current);
  return 0;
}
