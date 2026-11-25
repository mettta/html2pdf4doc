import os

from seleniumbase import BaseCase

from test.end2end.helpers.helper import Helper

path_to_this_test_file_folder = os.path.dirname(os.path.abspath(__file__))
case01_html_file_url = (
    "file:///" + os.path.join(path_to_this_test_file_folder, "case01.html")
)
case1_html_file_url = (
    "file:///" + os.path.join(path_to_this_test_file_folder, "case1.html")
)
case7_html_file_url = (
    "file:///" + os.path.join(path_to_this_test_file_folder, "case7.html")
)
case8_html_file_url = (
    "file:///" + os.path.join(path_to_this_test_file_folder, "case8.html")
)
case9_html_file_url = (
    "file:///" + os.path.join(path_to_this_test_file_folder, "case9.html")
)


class Test(BaseCase):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.helper = Helper(self)

        #   The purpose of this group of tests (01*)
        #   is to check the simplest GRID splitting mechanism
        #   (splitting between lines, not within a line)
        #   under different line formation conditions.

        #   The height of the lines is expected to be stable.
        #   With the correct GRIG split, the lines will be distributed across the pages as follows:
        #     1) 0, 1-3
        #     2) 4-9
        #     3) 10-12

        #   And it is expected that when changing
        #   the align/justify parameters of cells in a “row,”
        #   the splitting result will be stable.
    def test_01(self):
        # 3 pages
        self.helper.do_open(case01_html_file_url)
        self.helper.assert_document_has_pages(3)
        # # 1
        self.helper.assert_element_on_the_page('//*[@data-testid="L3-3"]', 1)
        # 2
        self.helper.assert_element_on_the_page('//*[@data-testid="L4-1"]', 2)
        self.helper.assert_element_on_the_page('//*[@data-testid="L9-3"]', 2)
        # 3
        self.helper.assert_element_on_the_page('//*[@data-testid="L10-1"]', 3)
        self.helper.assert_element_on_the_page('//*[@data-testid="L12-3"]', 3)
        self.helper.assert_element_on_the_page('//*[@data-testid="closer"]', 3)

    def test_1(self):
        # * Monotonic grid splits.
        # * a) The case without explicit `grid-columns` for cells.
        # * b) Overflow with `position: static` for grid container.
        # 2 pages
        self.helper.do_open(case1_html_file_url)
        self.helper.assert_document_has_pages(2)
        # # 1
        self.helper.assert_element_on_the_page('//*[@data-testid="L9-1"]', 1)
        self.helper.assert_element_on_the_page('//*[@data-testid="L9-2"]', 1)
        # 2
        self.helper.assert_element_on_the_page('//*[@data-testid="L10-2"]', 2)
        self.helper.assert_element_on_the_page('//*[@data-testid="L10-2"]', 2)
        self.helper.assert_element_on_the_page('//*[@data-testid="closer"]', 2)

    def test_7(self):
        # * Single grid row with long content is sliced via slicers.
        # * Expect at least two parts across pages with content preserved.
        self.helper.do_open(case7_html_file_url)
        self.helper.assert_document_has_pages(2)
        self.helper.assert_element_on_the_page('//*[@data-testid="chunk-1"]', 1)
        self.helper.assert_element_on_the_page('//*[@data-testid="chunk-4"]', 1)
        self.helper.assert_element_on_the_page('//*[@data-testid="chunk-5"]', 2)
        self.helper.assert_element_on_the_page('//*[@data-testid="chunk-8"]', 2)

    def test_8(self):
        # * last chunk has problematic height (inf. loop)
        self.helper.do_open(case8_html_file_url)
        self.helper.assert_document_has_pages(4)
        self.helper.assert_element_on_the_page('//*[@data-testid="chunk-1"]', 1)
        self.helper.assert_element_on_the_page('//*[@data-testid="chunk-4"]', 1)
        self.helper.assert_element_on_the_page('//*[@data-testid="like_image"]', 2)
        self.helper.assert_element_on_the_page('//*[@data-testid="chunk-5"]', 3)
        self.helper.assert_element_on_the_page('//*[@data-testid="chunk-7"]', 3)
        # TODO: last chunk should be split
        # self.helper.assert_element_on_the_page('//*[@data-testid="chunk-8"]', '???')

    def test_9(self):
        # * @data-testid="like_image" was scaled
        self.helper.do_open(case9_html_file_url)
        self.helper.assert_document_has_pages(3)
        self.helper.assert_element_on_the_page('//*[@data-testid="chunk-1"]', 1)
        self.helper.assert_element_on_the_page('//*[@data-testid="chunk-4"]', 1)
        self.helper.assert_element_on_the_page('//*[@data-testid="like_image"]', 2)
        self.helper.assert_element_on_the_page('//*[@data-testid="chunk-5"]', 3)
        self.helper.assert_element_on_the_page('//*[@data-testid="chunk-8"]', 3)

    def test_20(self):
        chunk_1 = '//*[@data-testid="root-element"][1]'
        chunk_2 = '//*[@data-testid="root-element"][2]'
        self.helper.open_case(path_to_this_test_file_folder, '20')
        self.helper.assert_document_has_pages(2)
        # 1 ----------------------------------
        self.helper.assert_element_on_the_page('//*[@data-testid="pusher"]', 1)
        self.helper.assert_element_on_the_page(chunk_1, 1)
        # 2 ----------------------------------
        self.helper.assert_element_on_the_page(chunk_2, 2)

    def test_21(self):
        chunk_1 = '//*[@data-testid="root-element"][1]'
        chunk_2 = '//*[@data-testid="root-element"][2]'
        chunk_3 = '//*[@data-testid="root-element"][3]'
        self.helper.open_case(path_to_this_test_file_folder, '21')
        self.helper.assert_document_has_pages(3)
        # 1 ----------------------------------
        self.helper.assert_element_on_the_page('//*[@data-testid="pusher"]', 1)
        self.helper.assert_element_on_the_page(chunk_1, 1)
        # 2 ----------------------------------
        self.helper.assert_element_on_the_page(chunk_2, 2)
        # 2 ----------------------------------
        self.helper.assert_element_on_the_page(chunk_3, 3)

    def test_22(self):
        chunk_1 = '//*[@data-testid="root-element"][1]'
        chunk_2 = '//*[@data-testid="root-element"][2]'
        self.helper.open_case(path_to_this_test_file_folder, '22')
        self.helper.assert_document_has_pages(2)
        # 1 ----------------------------------
        self.helper.assert_element_on_the_page('//*[@data-testid="pusher"]', 1)
        self.helper.assert_element_on_the_page(chunk_1, 1)
        self.helper.assert_element_on_the_page('//*[@data-testid="value10"]', 1)
        # 2 ----------------------------------
        self.helper.assert_element_on_the_page(chunk_2, 2)
        self.helper.assert_element_on_the_page('//*[@data-testid="closer"]', 2)

    def test_23(self):
        # * Single grid row with long content spans many pages.
        # * The row is sliced into more parts than 6 times the initial
        # * row count. Before the fix, the loop guard of grid.split
        # * counted only the initial rows and stopped the render.
        self.helper.open_case(path_to_this_test_file_folder, '23')
        self.helper.assert_html2pdf4doc_success()
        self.helper.assert_document_has_pages(14)
        self.helper.assert_element_on_the_page('//*[@data-testid="chunk-1"]', 1)
        self.helper.assert_element_on_the_page('//*[@data-testid="chunk-80"]', 14)
